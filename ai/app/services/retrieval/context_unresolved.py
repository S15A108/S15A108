"""Validate provisional unresolved candidates over selected approved context.

Internal interface only: no model, HTTP endpoint, authorization or persistence
is configured here. The caller must supply one authorized, current snapshot and
its own selection from that same snapshot. Output is never an approval or proof
that the project has no conflict or requirement.
"""

from dataclasses import dataclass
from typing import Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from app.services.llm_client import LLMError, LLMResult
from app.services.retrieval.context_selection import (
    ApprovedEvidence,
    ApprovedItem,
    SelectionInput,
    SelectionResult,
)


@dataclass(frozen=True, slots=True)
class ReviewInput:
    """Only selected inputs; the provider must treat these texts as data."""

    request: str
    items: tuple[ApprovedItem, ...]
    evidence: tuple[ApprovedEvidence, ...]


class UnresolvedAssessor(Protocol):
    async def assess(self, request: ReviewInput) -> LLMResult: ...


class _Output(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class _Reference(_Output):
    kind: Literal["design_item", "evidence"]
    id: str = Field(min_length=1, max_length=256)
    quote: str = Field(min_length=1, max_length=1000)

    @field_validator("id", "quote")
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("blank reference")
        return value


class _Candidate(_Output):
    kind: Literal["POSSIBLE_CONFLICT", "INSUFFICIENT_EVIDENCE"]
    description: str = Field(min_length=1, max_length=2000)
    references: list[_Reference] = Field(max_length=10)

    @field_validator("description")
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("blank description")
        return value


class _Proposal(_Output):
    candidates: list[_Candidate] = Field(max_length=50)


async def review_unresolved(
    snapshot: SelectionInput, selection: SelectionResult, assessor: UnresolvedAssessor
) -> LLMResult:
    """Return only bounded, source-checked candidates; preserve model usage."""
    if snapshot.search_status != "COMPLETE" or selection.search_status != "COMPLETE":
        raise ValueError("incomplete search")
    items = {item.design_item_version_id: item for item in snapshot.items}
    evidence = {item.evidence_id: item for item in snapshot.evidence}
    selected_ids = [item.design_item_version_id for item in selection.design_items]
    evidence_ids = list(selection.evidence_ids)
    if (
        len(set(selected_ids)) != len(selected_ids)
        or len(set(evidence_ids)) != len(evidence_ids)
        or not set(selected_ids).issubset(items)
        or not set(evidence_ids).issubset(evidence)
        or len(selected_ids) + len(evidence_ids) > 100
    ):
        raise ValueError("invalid selected context")
    selected_items = tuple(items[item_id] for item_id in selected_ids)
    selected_evidence = tuple(evidence[item_id] for item_id in evidence_ids)
    if (
        sum(len(x.text.encode("utf-8")) for x in (*selected_items, *selected_evidence))
        > 262144
    ):
        raise ValueError("selected context too large")
    data = ReviewInput(snapshot.request, selected_items, selected_evidence)
    response = await assessor.assess(data)
    if not isinstance(response, LLMResult):
        raise LLMError("invalid_output")
    try:
        proposal = _Proposal.model_validate(response.result)
        available = {
            **{
                ("design_item", x.design_item_version_id): x.text
                for x in selected_items
            },
            **{("evidence", x.evidence_id): x.text for x in selected_evidence},
        }
        for candidate in proposal.candidates:
            unique = set()
            for ref in candidate.references:
                key = (ref.kind, ref.id)
                if (
                    key not in available
                    or ref.quote not in available[key]
                    or key in unique
                ):
                    raise ValueError("invalid candidate reference")
                unique.add(key)
            if candidate.kind == "POSSIBLE_CONFLICT" and len(unique) < 2:
                raise ValueError("conflict needs at least two selected sources")
    except (ValidationError, TypeError, ValueError):
        raise response.invalid_output_error() from None
    return LLMResult(
        result={
            "scope": "selected_context_only",
            "selection_unresolved": list(selection.unresolved),
            "candidates": [
                candidate.model_dump(mode="json") for candidate in proposal.candidates
            ],
        },
        model=response.model,
        usage=response.usage,
        origin=response.origin,
    )
