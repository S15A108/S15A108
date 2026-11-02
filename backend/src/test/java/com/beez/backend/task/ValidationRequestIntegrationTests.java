package com.beez.backend.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.beez.backend.common.api.ApiException;
import com.beez.backend.common.auth.CallerContext;
import com.beez.backend.support.IntegrationTestSupport;
import com.beez.backend.validation.dto.AcceptResult;
import com.beez.backend.validation.service.ValidationAcceptService;
import com.beez.backend.validation.service.ValidationRequestService;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** PostgreSQL integration coverage; needs the normal Docker-backed test environment. */
class ValidationRequestIntegrationTests extends IntegrationTestSupport {
    @Autowired DataSource dataSource;
    @Autowired ValidationRequestService service;
    @Autowired ValidationAcceptService acceptance;
    TaskApiSupport api;
    long project;
    long account;
    long task;
    long revision;
    int lock;

    @BeforeEach
    void setUp() {
        api = new TaskApiSupport(this::client, dataSource);
        api.resetAndLoadFixture();
        project = api.projectId();
        account = api.accountId("member@test");
        var created = api.post("/api/projects/" + project + "/tasks", api.planJson("target", api.implementsRef("API-01"), "[]"), account);
        assertThat(created.statusCode()).isEqualTo(201);
        task = TaskApiSupport.longField(created.body(), "id");
        var row = api.jdbc.sql("select current_plan_revision_id,lock_version from task where id=:id").param("id", task).query().singleRow();
        revision = ((Number) row.get("current_plan_revision_id")).longValue();
        lock = ((Number) row.get("lock_version")).intValue();
    }

    private AcceptResult accept(CallerContext caller, int expectedLockVersion, String key) {
        return acceptance.accept(caller, project, task, revision, expectedLockVersion, key);
    }

    @Test
    void queuesOnceAndReplayReturnsTheSameAcceptanceAfterThePlanChanges() {
        var caller = CallerContext.human(account);
        var first = accept(caller, lock, "request-1");
        assertThat(first.finished()).isFalse();
        assertThat(first.validation().status()).isEqualTo("RUNNING");
        long validation = Long.parseLong(first.validation().id());
        assertThat(api.jdbc.sql("select count(*) from validation_job where validation_id=:id and status='QUEUED'")
                .param("id", validation).query(Long.class).single()).isEqualTo(1L);
        api.jdbc.sql("update task set lock_version=lock_version+1 where id=:id").param("id", task).update();
        assertThat(accept(caller, lock, "request-1")).isEqualTo(first);
        assertThatThrownBy(() -> accept(caller, lock + 1, "request-1"))
                .isInstanceOf(ApiException.class).extracting(e -> ((ApiException) e).getCode()).isEqualTo("idempotency_conflict");
        assertThat(service.get(caller, project, validation).get("id")).isEqualTo(Long.toString(validation));
    }

    @Test
    void rejectsStalePlanAndNonOwnerAndDoesNotCreateJob() {
        assertThatThrownBy(() -> accept(CallerContext.human(account), lock + 1, "stale"))
                .isInstanceOf(ApiException.class).extracting(e -> ((ApiException) e).getCode()).isEqualTo("revision_conflict");
        assertThatThrownBy(() -> accept(CallerContext.human(api.accountId("leader@test")), lock, "not-owner"))
                .isInstanceOf(ApiException.class);
        assertThat(api.jdbc.sql("select count(*) from validation where task_id=:id").param("id", task).query(Long.class).single()).isZero();
    }

    private long failedValidation(String resolution) {
        long id = Long.parseLong(accept(CallerContext.human(account), lock, "initial").validation().id());
        long run = api.jdbc.sql("update validation_run set status='ERROR',error='failure' where validation_id=:id and attempt=1 returning id")
                .param("id", id).query(Long.class).single();
        api.jdbc.sql("insert into validation_finding(validation_id,validation_run_id,source,kind,severity,message,resolution) values(:id,:run,'MODEL','ERROR','BLOCKING','failure',:resolution)")
                .param("id", id).param("run", run).param("resolution", resolution).update();
        api.jdbc.sql("update validation set status='ERROR' where id=:id").param("id", id).update();
        api.jdbc.sql("update validation_job set status='FAILED' where validation_id=:id").param("id", id).update();
        return id;
    }

    @Test
    void retriesOnlyLatestRetryFindingAndKeepsBothAcceptanceReplayKeys() {
        long id = failedValidation("RETRY");
        var caller = CallerContext.human(account);
        var retried = service.retry(caller, project, id, 1, "retry-one");
        assertThat(retried.get("status")).isEqualTo("RUNNING");
        assertThat(retried.get("current_attempt")).isEqualTo(2);
        assertThat(service.retry(caller, project, id, 1, "retry-one")).isEqualTo(retried);
        assertThat(accept(caller, lock, "initial").validation().id()).isEqualTo(Long.toString(id));
        assertThatThrownBy(() -> service.retry(caller, project, id, 2, "retry-one"))
                .isInstanceOf(ApiException.class).extracting(e -> ((ApiException) e).getCode()).isEqualTo("idempotency_conflict");
    }

    @Test
    void humanReviewCannotBeRetried() {
        long id = failedValidation("HUMAN_REVIEW");
        assertThatThrownBy(() -> service.retry(CallerContext.human(account), project, id, 1, "try"))
                .isInstanceOf(ApiException.class).extracting(e -> ((ApiException) e).getCode()).isEqualTo("invalid_transition");
    }
}
