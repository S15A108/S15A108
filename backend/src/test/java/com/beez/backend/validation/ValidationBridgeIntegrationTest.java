package com.beez.backend.validation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.beez.backend.document.service.HybridDocumentCandidateSearch;
import com.beez.backend.support.IntegrationTestSupport;
import com.beez.backend.task.TaskApiSupport;
import com.beez.backend.validation.service.ValidationAnalyzer;
import com.beez.backend.validation.worker.ValidationWorker;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import tools.jackson.databind.json.JsonMapper;

/** Actual DB and unified worker; search and AI are controlled test doubles. */
class ValidationBridgeIntegrationTest extends IntegrationTestSupport {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    @Autowired DataSource dataSource;
    @Autowired ValidationWorker worker;
    @MockitoBean HybridDocumentCandidateSearch search;
    @MockitoBean ValidationAnalyzer analyzer;
    private TaskApiSupport api;
    private long project, owner, baseline;

    @BeforeEach void setup() {
        api = new TaskApiSupport(this::client, dataSource);
        api.resetAndLoadFixture();
        project = api.projectId(); owner = api.accountId("member@test");
        baseline = api.jdbc.sql("select current_baseline_id from project where id=:p")
                .param("p", project).query(Long.class).single();
        when(search.search(any(), eq(project), anyString(), isNull(), isNull(), eq(100)))
                .thenReturn(new HybridDocumentCandidateSearch.Result(Long.toString(baseline), List.of(), false, false));
    }

    @Test void acceptedJobUsesExistingRunAndAppliesIncompleteAiResultSafely() throws Exception {
        var task = api.post("/api/projects/" + project + "/tasks",
                api.planJson("회원 확인", api.implementsRef("API-01"), "[]"), owner);
        assertThat(task.statusCode()).as(task.body()).isEqualTo(201);
        long taskId = TaskApiSupport.longField(task.body(), "id");
        long revision = api.jdbc.sql("select current_plan_revision_id from task where id=:t")
                .param("t", taskId).query(Long.class).single();
        long version = TaskApiSupport.longField(task.body(), "lock_version");
        String path = "/api/projects/" + project + "/tasks/" + taskId + "/validations";
        String body = "{\"plan_revision_id\":\"" + revision + "\",\"expected_lock_version\":" + version + "}";
        var accepted = api.postWithHeaders(path, body, owner, "Idempotency-Key", "bridge-test");
        assertThat(accepted.statusCode()).as(accepted.body()).isEqualTo(202);
        long validation = JSON.readTree(accepted.body()).get("id").asLong();
        var replay = api.postWithHeaders(path, body, owner, "Idempotency-Key", "bridge-test");
        assertThat(replay.statusCode()).as(replay.body()).isEqualTo(202);
        assertThat(JSON.readTree(replay.body())).isEqualTo(JSON.readTree(accepted.body()));
        var conflict = api.postWithHeaders(path,
                "{\"plan_revision_id\":\"" + revision + "\",\"expected_lock_version\":" + (version + 1) + "}",
                owner, "Idempotency-Key", "bridge-test");
        assertThat(conflict.statusCode()).as(conflict.body()).isEqualTo(409);
        assertThat(api.jdbc.sql("select count(*) from validation where task_id=:t")
                .param("t", taskId).query(Integer.class).single()).isEqualTo(1);
        AtomicReference<Map<String, Object>> sent = new AtomicReference<>();
        when(analyzer.analyze(any())).thenAnswer(call -> {
            Map<String, Object> request = call.getArgument(0);
            sent.set(request);
            List<Map<String, Object>> unassessed = new ArrayList<>();
            for (Object check : (List<?>) request.get("checks")) {
                unassessed.add(Map.of("check_key", ((Map<?, ?>) check).get("key"),
                        "reason", "EVIDENCE_INSUFFICIENT", "message", "근거 부족"));
            }
            return Map.of("origin", "MODEL", "model", "test-model", "usage", List.of(Map.of(
                    "request_key", "llm-validate-" + validation + "-attempt-1-call-1", "feature", "TASK_VALIDATION",
                    "model", "test-model", "failed", false, "tokens_known", false, "latency_ms", 10)),
                    "result", Map.of("analysis_status", "PARTIAL", "checked_keys", List.of(),
                            "unassessed", unassessed, "findings", List.of()));
        });

        assertThat(worker.runOnce()).isTrue();
        assertThat(sent.get()).as("AI analyzer was invoked after approved context assembly").isNotNull();
        assertThat(api.jdbc.sql("select count(*) from validation_run where validation_id=:v")
                .param("v", validation).query(Integer.class).single()).isEqualTo(1);
        assertThat(api.jdbc.sql("select status from validation where id=:v")
                .param("v", validation).query(String.class).single()).isEqualTo("ERROR");
        assertThat(api.jdbc.sql("select resolution from validation_finding where validation_id=:v and kind='ERROR'")
                .param("v", validation).query(String.class).single()).isEqualTo("HUMAN_REVIEW");
        assertThat(api.jdbc.sql("select count(*) from llm_usage where task_id=:t")
                .param("t", taskId).query(Integer.class).single()).isEqualTo(1);
    }

    @Test void synchronousValidationChecksExplicitDependenciesBeforePass() throws Exception {
        var task = api.post("/api/projects/" + project + "/tasks",
                api.planJson("의존성 확인", api.readsRef("API-01"), "[]"), owner);
        long taskId = TaskApiSupport.longField(task.body(), "id");
        long revision = api.jdbc.sql("select current_plan_revision_id from task where id=:t")
                .param("t", taskId).query(Long.class).single();
        // Simulate a persisted stale dependency; registration validation is not the subject here.
        api.jdbc.sql("update task_plan_revision set dependency_task_ids='[999999]'::jsonb where id=:r")
                .param("r", revision).update();
        var result = api.postWithHeaders("/api/projects/" + project + "/tasks/" + taskId + "/validations",
                "{\"plan_revision_id\":\"" + revision + "\",\"expected_lock_version\":"
                        + TaskApiSupport.longField(task.body(), "lock_version") + "}", owner,
                "Idempotency-Key", "dependency-check");
        assertThat(result.statusCode()).as(result.body()).isEqualTo(200);
        assertThat(JSON.readTree(result.body()).get("status").asText()).isEqualTo("NEEDS_INPUT");
        verifyNoInteractions(analyzer);
    }

    @Test void blockingConflictTakesPriorityOverMissingInput() throws Exception {
        var first = api.post("/api/projects/" + project + "/tasks",
                api.planJson("선행 변경", api.changesRef("API-01"), "[]")
                        .replace("\"no_contract_change\": true", "\"no_contract_change\": false"), owner);
        long firstId = TaskApiSupport.longField(first.body(), "id");
        long firstRevision = api.jdbc.sql("select current_plan_revision_id from task where id=:t")
                .param("t", firstId).query(Long.class).single();
        long pass = api.passValidation(firstId);
        var start = api.post("/api/projects/" + project + "/tasks/" + firstId + "/state-events",
                "{\"event\":\"START\",\"plan_revision_id\":\"" + firstRevision
                        + "\",\"expected_lock_version\":" + TaskApiSupport.longField(first.body(), "lock_version")
                        + ",\"validation_id\":\"" + pass + "\"}", owner);
        assertThat(start.statusCode()).as(start.body()).isEqualTo(200);
        var second = api.post("/api/projects/" + project + "/tasks",
                api.planJson("충돌 변경", api.changesRef("API-01"), "[]"), owner);
        long secondId = TaskApiSupport.longField(second.body(), "id");
        long revision = api.jdbc.sql("select current_plan_revision_id from task where id=:t")
                .param("t", secondId).query(Long.class).single();
        var result = api.postWithHeaders("/api/projects/" + project + "/tasks/" + secondId + "/validations",
                "{\"plan_revision_id\":\"" + revision + "\",\"expected_lock_version\":"
                        + TaskApiSupport.longField(second.body(), "lock_version") + "}", owner,
                "Idempotency-Key", "conflict-and-missing");
        assertThat(result.statusCode()).as(result.body()).isEqualTo(200);
        var json = JSON.readTree(result.body());
        assertThat(json.get("status").asText()).isEqualTo("NEEDS_REVIEW");
        assertThat(result.body()).contains("MISSING_INPUT", "CONFLICT");
        verifyNoInteractions(analyzer);
    }
}
