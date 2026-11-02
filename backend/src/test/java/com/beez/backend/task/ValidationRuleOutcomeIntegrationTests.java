package com.beez.backend.task;

import static org.assertj.core.api.Assertions.assertThat;

import com.beez.backend.common.auth.CallerContext;
import com.beez.backend.support.IntegrationTestSupport;
import com.beez.backend.validation.service.ValidationOutcomeWriter;
import com.beez.backend.validation.service.ValidationAcceptService;
import com.beez.backend.validation.service.ValidationRuleOutcomeWriter;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Integration coverage for rule transaction and lease fencing; needs PostgreSQL. */
class ValidationRuleOutcomeIntegrationTests extends IntegrationTestSupport {
    @Autowired DataSource dataSource;
    @Autowired ValidationAcceptService requests;
    @Autowired ValidationRuleOutcomeWriter writer;
    TaskApiSupport api;
    long project, owner, baseline;

    @BeforeEach
    void setUp() {
        api = new TaskApiSupport(this::client, dataSource);
        api.resetAndLoadFixture();
        project = api.projectId(); owner = api.accountId("member@test");
        baseline = api.jdbc.sql("select current_baseline_id from project where id=:id").param("id", project).query(Long.class).single();
    }

    private long create(String title, boolean changing) {
        String ref = changing ? api.changesRef("API-01") : api.implementsRef("API-01");
        String plan = api.planJson(title, ref, "[]");
        if (changing) plan = plan.replace("\"no_contract_change\": true", "\"no_contract_change\": false");
        var response = api.post("/api/projects/" + project + "/tasks", plan, owner);
        assertThat(response.statusCode()).isEqualTo(201);
        return TaskApiSupport.longField(response.body(), "id");
    }
    private long revision(long task) {
        return api.jdbc.sql("select current_plan_revision_id from task where id=:id").param("id", task).query(Long.class).single();
    }
    private ValidationOutcomeWriter.Execution claim(long task) {
        long revision = revision(task);
        int lock = api.jdbc.sql("select lock_version from task where id=:id").param("id", task).query(Integer.class).single();
        var accepted = requests.accept(CallerContext.human(owner), project, task, revision, lock, "test-" + task);
        assertThat(accepted.finished()).isFalse();
        long validation = Long.parseLong(accepted.validation().id());
        UUID lease = UUID.randomUUID();
        api.jdbc.sql("update validation_job set status='LEASED',attempts=1,lease_token=:token,lease_until=now()+interval '1 minute' where validation_id=:id")
                .param("id", validation).param("token", lease).update();
        long run = api.jdbc.sql("update validation_run set lease_token=:token where validation_id=:id and attempt=1 returning id")
                .param("id", validation).param("token", lease).query(Long.class).single();
        return new ValidationOutcomeWriter.Execution(project, task, validation, run, 1, lease, baseline, revision, Map.of(), "gms", CallerContext.human(owner));
    }

    @Test
    void rulesCompleteAtomicallyWithoutCallingModelWhenChangeCollides() {
        long target = create("대상", true), other = create("다른 작업", true);
        long approved = api.jdbc.sql("""
                insert into validation(task_id,plan_revision_id,baseline_id,status,trigger,input_snapshot_hash,rule_version)
                values(:task,:revision,:baseline,'PASS','AGENT','fixture','test') returning id
                """).param("task", other).param("revision", revision(other)).param("baseline", baseline).query(Long.class).single();
        api.jdbc.sql("update task set status='IN_PROGRESS',started_validation_id=:validation where id=:id")
                .param("id", other).param("validation", approved).update();
        long revision = revision(target);
        int lock = api.jdbc.sql("select lock_version from task where id=:id").param("id", target).query(Integer.class).single();
        var accepted = requests.accept(CallerContext.human(owner), project, target, revision, lock, "conflict-" + target);
        assertThat(accepted.finished()).isTrue();
        assertThat(accepted.validation().status()).isEqualTo("NEEDS_REVIEW");
        long validation = Long.parseLong(accepted.validation().id());
        assertThat(api.jdbc.sql("select count(*) from validation_finding where validation_id=:id and source='RULE' and kind='CONFLICT'")
                .param("id", validation).query(Long.class).single()).isEqualTo(1);
        assertThat(api.jdbc.sql("select count(*) from validation_run where validation_id=:id")
                .param("id", validation).query(Long.class).single()).isZero();
        assertThat(api.jdbc.sql("select count(*) from validation_job where validation_id=:id")
                .param("id", validation).query(Long.class).single()).isZero();
    }

    @Test
    void conflictAddedAfterAcceptanceDiscardsPriorSnapshot() {
        long target = create("대상", true);
        var execution = claim(target);
        long other = create("다른 작업", true);
        long approved = api.jdbc.sql("""
                insert into validation(task_id,plan_revision_id,baseline_id,status,trigger,input_snapshot_hash,rule_version)
                values(:task,:revision,:baseline,'PASS','AGENT','fixture','test') returning id
                """).param("task", other).param("revision", revision(other)).param("baseline", baseline).query(Long.class).single();
        api.jdbc.sql("update task set status='IN_PROGRESS',started_validation_id=:validation where id=:id")
                .param("id", other).param("validation", approved).update();

        assertThat(writer.apply(execution, CallerContext.human(owner))).isEqualTo(ValidationRuleOutcomeWriter.Applied.DISCARDED);
        assertThat(api.jdbc.sql("select status from validation where id=:id").param("id", execution.validationId()).query(String.class).single()).isEqualTo("STALE");
        assertThat(api.jdbc.sql("select status from validation_run where id=:id").param("id", execution.runId()).query(String.class).single()).isEqualTo("DISCARDED");
        assertThat(api.jdbc.sql("select count(*) from validation_finding where validation_id=:id")
                .param("id", execution.validationId()).query(Long.class).single()).isZero();
    }

    @Test
    void noFindingsLeaveOwnedRunForModelAndExpiredLeaseCannotFinalize() {
        var execution = claim(create("정상", false));
        assertThat(writer.apply(execution, CallerContext.human(owner))).isEqualTo(ValidationRuleOutcomeWriter.Applied.CONTINUE);
        assertThat(api.jdbc.sql("select status from validation_run where id=:id").param("id", execution.runId()).query(String.class).single()).isEqualTo("RUNNING");
        api.jdbc.sql("update validation_job set lease_until=now()-interval '1 second' where validation_id=:id")
                .param("id", execution.validationId()).update();
        assertThat(writer.apply(execution, CallerContext.human(owner))).isEqualTo(ValidationRuleOutcomeWriter.Applied.DISCARDED);
        assertThat(api.jdbc.sql("select status from validation where id=:id").param("id", execution.validationId()).query(String.class).single()).isEqualTo("RUNNING");
    }
}
