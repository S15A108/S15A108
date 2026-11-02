package com.beez.backend.validation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.beez.backend.common.auth.CallerContext;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** 서버용 가짜 분석기의 응답이 실제 응답과 같은 계약 검사를 통과하는지 (S15P31A108-159) */
class FakeValidationAnalyzerTest {

    private static Map<String, Object> check(String key, String kind) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("key", key);
        c.put("kind", kind);
        c.put("design_item_version_ids", List.of());
        c.put("related_plan_revision_ids", List.of());
        return c;
    }

    @Test
    void answersEveryCheckWithoutCandidates_andPassesTheContractCheck() {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("validation_id", "1");
        request.put("project_id", "2");
        request.put("attempt", 1);
        request.put("plan_revision", Map.of("id", "3", "task_id", "4"));
        request.put("checks", List.of(check("plan-completeness", "PLAN_COMPLETENESS"), check("design-7", "DESIGN_ALIGNMENT")));
        request.put("approved_items", List.of());
        request.put("related_plans", List.of());
        request.put("rule_findings", List.of());
        request.put("evidence", List.of());
        request.put("unresolved", List.of());

        Map<String, Object> response = new FakeValidationAnalyzer().analyze(request);

        Map<?, ?> result = (Map<?, ?>) response.get("result");
        assertThat(result.get("checked_keys")).isEqualTo(List.of("plan-completeness", "design-7"));
        assertThat(result.get("findings")).isEqualTo(List.of());
        assertThat(response.get("model")).isEqualTo(FakeValidationAnalyzer.MODEL);
        assertThat(response.get("usage")).isEqualTo(List.of());     // 실제 모델 호출이 없으니 사용량도 없다

        var execution = new ValidationOutcomeWriter.Execution(2, 4, 1, 5, 1, UUID.randomUUID(), 6, 3,
                Map.of(), "gms", CallerContext.human(7L));
        @SuppressWarnings("unchecked") Map<String, Object> modelResult = (Map<String, Object>) response.get("result");
        assertThatCode(() -> ValidationOutcomeWriter.verify(execution, request, modelResult)).doesNotThrowAnyException();
    }
}
