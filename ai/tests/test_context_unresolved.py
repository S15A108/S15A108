import pytest

from app.services.llm_client import LLMError, LLMResult, LLMUsage
from app.services.retrieval.context_selection import (
    ApprovedEvidence,
    ApprovedItem,
    SelectedItem,
    SelectionInput,
    SelectionResult,
)
from app.services.retrieval.context_unresolved import review_unresolved


def snapshot():
    return SelectionInput(
        project_id="p",
        baseline_id="b",
        request="업로드 제한 확인",
        task_id=None,
        document_version_ids=("d1", "d2"),
        items=(
            ApprovedItem(
                design_item_id="i1",
                design_item_version_id="v1",
                project_id="p",
                baseline_id="b",
                status="APPROVED",
                text="업로드 한도는 30 MB입니다.",
            ),
        ),
        evidence=(
            ApprovedEvidence(
                evidence_id="e1",
                document_version_id="d1",
                project_id="p",
                baseline_id="b",
                text="최대 20 MB입니다.",
            ),
            ApprovedEvidence(
                evidence_id="e2",
                document_version_id="d2",
                project_id="p",
                baseline_id="b",
                text="내부 전용 원문",
            ),
        ),
        relations=(),
        task_design_refs=(),
        search_status="COMPLETE",
    )


def selection():
    return SelectionResult(
        design_items=(SelectedItem(design_item_version_id="v1", reasons=("MATCHED",)),),
        evidence_ids=("e1",),
        unresolved=(),
    )


class Assessor:
    def __init__(self, result):
        self.result = result
        self.input = None

    async def assess(self, request):
        self.input = request
        usage = LLMUsage(
            request_key="call",
            feature="BEE_CHAT",
            project_id="p",
            model="fake",
            latency_ms=1,
            failed=False,
            tokens_known=True,
            input_tokens=10,
            output_tokens=5,
        )
        return LLMResult(result=self.result, model="fake", usage=(usage,))


def conflict():
    return {
        "kind": "POSSIBLE_CONFLICT",
        "description": "업로드 한도가 서로 다를 수 있습니다.",
        "references": [
            {"kind": "design_item", "id": "v1", "quote": "30 MB"},
            {"kind": "evidence", "id": "e1", "quote": "20 MB"},
        ],
    }


@pytest.mark.asyncio
async def test_conflict_is_a_candidate_with_selected_exact_citations_and_usage():
    assessor = Assessor({"candidates": [conflict()]})
    result = await review_unresolved(snapshot(), selection(), assessor)
    assert result.result["scope"] == "selected_context_only"
    assert result.result["candidates"][0]["kind"] == "POSSIBLE_CONFLICT"
    assert result.usage[0].request_key == "call" and not result.usage[0].failed
    assert [e.evidence_id for e in assessor.input.evidence] == ["e1"]


@pytest.mark.parametrize(
    "mutation",
    ["foreign", "fabricated_quote", "single_source", "blank", "unknown_kind"],
)
@pytest.mark.asyncio
async def test_rejects_unselected_forged_or_unverifiable_conflicts(mutation):
    candidate = conflict()
    if mutation == "foreign":
        candidate["references"][1] = {
            "kind": "evidence",
            "id": "e2",
            "quote": "내부 전용",
        }
    elif mutation == "fabricated_quote":
        candidate["references"][1]["quote"] = "200 MB"
    elif mutation == "single_source":
        candidate["references"].pop()
    elif mutation == "blank":
        candidate["description"] = "  "
    else:
        candidate["kind"] = "CONFIRMED_CONFLICT"
    with pytest.raises(LLMError) as error:
        await review_unresolved(
            snapshot(), selection(), Assessor({"candidates": [candidate]})
        )
    assert error.value.code == "invalid_output"
    assert error.value.usage[0].failed
    assert error.value.usage[0].input_tokens == 10


@pytest.mark.asyncio
async def test_insufficient_evidence_is_not_a_claim_that_design_is_absent():
    candidate = {
        "kind": "INSUFFICIENT_EVIDENCE",
        "description": "보관 기간 근거가 부족합니다.",
        "references": [],
    }
    result = await review_unresolved(
        snapshot(), selection(), Assessor({"candidates": [candidate]})
    )
    assert result.result["candidates"][0]["kind"] == "INSUFFICIENT_EVIDENCE"


@pytest.mark.asyncio
async def test_rejects_unknown_selection_before_calling_assessor():
    selected = SelectionResult(
        design_items=(), evidence_ids=("unknown",), unresolved=()
    )
    assessor = Assessor({"candidates": []})
    with pytest.raises(ValueError):
        await review_unresolved(snapshot(), selected, assessor)
    assert assessor.input is None


@pytest.mark.asyncio
async def test_failed_search_does_not_call_assessor_or_become_no_candidates():
    data = snapshot().model_copy(update={"search_status": "FAILED"})
    assessor = Assessor({"candidates": []})
    with pytest.raises(ValueError):
        await review_unresolved(data, selection(), assessor)
    assert assessor.input is None


@pytest.mark.asyncio
async def test_no_match_remains_visible_even_when_review_returns_no_candidates():
    selected = SelectionResult(
        design_items=(), evidence_ids=(), unresolved=("NO_MATCH",)
    )
    result = await review_unresolved(snapshot(), selected, Assessor({"candidates": []}))
    assert result.result == {
        "scope": "selected_context_only",
        "selection_unresolved": ["NO_MATCH"],
        "candidates": [],
    }


@pytest.mark.asyncio
async def test_assessor_failure_is_not_returned_as_success():
    class Failure:
        async def assess(self, request):
            raise LLMError("model_unavailable")

    with pytest.raises(LLMError) as error:
        await review_unresolved(snapshot(), selection(), Failure())
    assert error.value.code == "model_unavailable"


@pytest.mark.asyncio
async def test_duplicate_selected_ids_are_rejected_before_assessment():
    selected = SelectionResult(
        design_items=(), evidence_ids=("e1", "e1"), unresolved=()
    )
    assessor = Assessor({"candidates": []})
    with pytest.raises(ValueError):
        await review_unresolved(snapshot(), selected, assessor)
    assert assessor.input is None
