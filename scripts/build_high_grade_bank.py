#!/usr/bin/env python3
"""Build the offline securities senior specialist question bank from local PDFs."""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

from pypdf import PdfReader

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


DIST = Path(__file__).resolve().parents[1]
WORKSPACE = DIST.parent.parent
SOURCE_ROOT = WORKSPACE / "高業考古題來源" / "證券商高級業務員(高業)10501-11502"
BANK_DIR = DIST / "data" / "證券商高級業務員"
OVERRIDES_PATH = BANK_DIR / "answer-key-overrides.json"
OUTPUT_PATH = BANK_DIR / "offline-question-bank.js"
MANIFEST_PATH = DIST / "data" / "manifest.json"

SUBJECTS = ["投資學", "財務分析", "證券交易相關法規與實務"]
QUESTION_START = re.compile(r"(?m)^[ \t]*(\d{1,2})\s*[.．、](?!\d)\s*")
OPTION_MARKER = re.compile(r"[（(]\s*([A-D])\s*\$?\s*[）)]")
ANSWER_PAIR = re.compile(r"(?<!\d)(\d{1,2})\s*(?:[|│]\s*)?([A-D](?:[./、,]?[A-D]){0,3}|均給分|送分)")


def compact(value: str) -> str:
    value = value.replace("\u3000", " ").replace("\xa0", " ").replace("\ufeff", " ")
    return re.sub(r"\s+", " ", value).strip(" \t\r\n|│")


def identify_subject(text: str) -> str | None:
    text = unicodedata.normalize("NFKC", text)
    if "證券交易相關法規與實務" in text:
        return SUBJECTS[2]
    if "試卷「財務分析」" in text or "試卷\"財務分析\"" in text:
        return SUBJECTS[1]
    if "試卷「投資學」" in text or "試卷\"投資學\"" in text:
        return SUBJECTS[0]
    return None


def identify_subject_from_name(name: str) -> str | None:
    name = unicodedata.normalize("NFKC", name)
    if "證券交易相關法規與實務" in name:
        return SUBJECTS[2]
    if "試卷「投資學」" in name or "－「投資學」" in name or "-「投資學」" in name:
        return SUBJECTS[0]
    if "試卷「財務分析」" in name or "－「財務分析」" in name or "-「財務分析」" in name:
        return SUBJECTS[1]
    if "投資學" in name:
        return SUBJECTS[0]
    if "財務分析" in name:
        return SUBJECTS[1]
    return None


def identify_session(text: str, path: Path) -> tuple[int, int] | None:
    match = re.search(r"(10\d|11\d)\s*年\s*第?\s*(\d)\s*次", text)
    if match:
        return int(match.group(1)), int(match.group(2))
    match = re.search(r"(?<!\d)(10\d|11\d)(0[1-4])(?!\d)", path.stem)
    if match:
        return int(match.group(1)), int(match.group(2)[1])
    match = re.search(r"(?<!\d)(10\d|11\d)\s*年?.*?Q\s*([1-4])", path.stem, re.I)
    if match:
        return int(match.group(1)), int(match.group(2))
    return None


def load_pdf(path: Path):
    reader = PdfReader(str(path))
    page_texts = [(page.extract_text() or "") for page in reader.pages]
    return reader, page_texts


def extract_questions(path: Path, page_texts: list[str]):
    session = identify_session("\n".join(page_texts[:2]), path)
    if not session:
        return []

    filename_subject = identify_subject_from_name(path.name)
    current_subject = filename_subject
    grouped: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for page_index, text in enumerate(page_texts, 1):
        found = identify_subject(text[:1000])
        if found:
            current_subject = found
        if current_subject:
            grouped[current_subject].append((page_index, text))

    output = []
    for subject, pages in grouped.items():
        combined = "\n".join(text for _, text in pages)
        offsets = []
        current = 0
        for page_number, text in pages:
            offsets.append((current, current + len(text), page_number))
            current += len(text) + 1

        starts = []
        expected_number = 1
        for match in QUESTION_START.finditer(combined):
            number = int(match.group(1))
            if number == expected_number:
                starts.append(match)
                expected_number += 1
                if expected_number > 50:
                    break
        for index, start in enumerate(starts):
            number = int(start.group(1))
            end = starts[index + 1].start() if index + 1 < len(starts) else len(combined)
            block = combined[start.start():end]
            parsed = parse_question_block(block, number)
            if not parsed:
                continue
            page_numbers = [page for begin, finish, page in offsets if begin <= start.start() < finish]
            output.append({
                "year": session[0],
                "session": session[1],
                "subject": subject,
                "number": number,
                "question": parsed[0],
                "options": parsed[1],
                "file": path.relative_to(SOURCE_ROOT).as_posix(),
                "pages": page_numbers or [pages[0][0]],
                "parseScore": parsed[2],
            })
    return output


def parse_question_block(block: str, number: int):
    block = unicodedata.normalize("NFKC", block)
    block = re.sub(r"^\s*\d{1,2}\s*[.．、]\s*", "", block, count=1)
    markers = list(OPTION_MARKER.finditer(block))
    sequences = []
    for i, a in enumerate(markers):
        if a.group(1) != "A":
            continue
        for j in range(i + 1, len(markers)):
            if markers[j].group(1) != "B":
                continue
            for k in range(j + 1, len(markers)):
                if markers[k].group(1) != "C":
                    continue
                for n in range(k + 1, len(markers)):
                    if markers[n].group(1) == "D":
                        sequences.append((n - i - 3, i, [a, markers[j], markers[k], markers[n]]))
    selected = min(sequences, key=lambda item: (item[0], item[1]))[2] if sequences else None
    if not selected:
        return None

    stem = compact(block[:selected[0].start()])
    options = []
    for idx, marker in enumerate(selected):
        end = selected[idx + 1].start() if idx < 3 else len(block)
        option = block[marker.end():end]
        option = re.split(r"(?:試題解答|資格測驗試題解答|原\s*\d{1,2}/\d{1,2}.*?修正)", option, maxsplit=1)[0]
        # The final question is followed by compact answer tables in some source PDFs.
        option = re.split(r"\s+1\s+[A-D](?:\s+11\s+[A-D]){2,}", option, maxsplit=1)[0]
        options.append(compact(option))

    if not stem or any(not option for option in options):
        return None
    score = min(10, len(stem) // 30) + sum(1 for option in options if len(option) >= 2)
    return stem, options, score


def answer_tokens_to_list(token: str):
    if token in ("均給分", "送分"):
        return list("ABCD")
    letters = re.findall(r"[A-D]", token)
    return list(dict.fromkeys(letters))


def answer_groups(text: str):
    pairs = [(int(m.group(1)), answer_tokens_to_list(m.group(2))) for m in ANSWER_PAIR.finditer(text)]
    expected = set(range(1, 51))
    groups = []
    if pairs and len(pairs) % 50 == 0:
        for start in range(0, len(pairs), 50):
            chunk = pairs[start:start + 50]
            if {n for n, _ in chunk} == expected:
                groups.append({n: answers for n, answers in chunk})
            else:
                groups = []
                break
    if not groups:
        for start in range(max(0, len(pairs) - 49)):
            chunk = pairs[start:start + 50]
            if len(chunk) == 50 and {n for n, _ in chunk} == expected:
                groups.append({n: answers for n, answers in chunk})
    # Keep one copy of each consecutive sequence; repeated renderings can occur in PDFs.
    unique = []
    seen = set()
    for group in groups:
        signature = tuple((n, tuple(group[n])) for n in range(1, 51))
        if signature not in seen:
            seen.add(signature)
            unique.append(group)
    return unique


def parse_session_from_answer_file(path: Path, texts: list[str]):
    return identify_session("\n".join(texts[:2]), path)


def gather_pdf_sources():
    questions = defaultdict(list)
    raw_answer_docs = defaultdict(list)
    source_pdf_count = 0
    paths = list(SOURCE_ROOT.rglob("*.pdf")) + list(BANK_DIR.glob("*official.pdf"))
    for path in paths:
        if "價值筆記" in path.name:
            continue
        try:
            _, pages = load_pdf(path)
        except Exception as exc:
            print(f"SKIP PDF {path.name}: {exc}")
            continue
        text = "\n".join(pages)
        session = parse_session_from_answer_file(path, pages)
        if not session:
            continue
        answer_only = path.stem.lower().endswith("a") or path.parent == BANK_DIR
        if answer_only:
            raw_answer_docs[session].append((path, pages))
            continue
        if "資格測驗試題" not in text[:1200]:
            continue
        source_pdf_count += 1
        for q in extract_questions(path, pages):
            questions[(q["year"], q["session"], q["subject"], q["number"])].append(q)
        raw_answer_docs[session].append((path, pages))
    return questions, raw_answer_docs, source_pdf_count


def choose_question(candidates):
    # Prefer a full, well-formed item, then a PDF whose title names its subject.
    return max(candidates, key=lambda q: (q["parseScore"], len(q["question"]), -len(q["file"])))


def build_keys(raw_answer_docs, overrides):
    output = {}
    for session, docs in raw_answer_docs.items():
        year, exam_number = session
        key_name = f"{year + 1911}-{exam_number:02d}"
        override = overrides.get(key_name, {}).get("subjects", {})
        for subject, data in override.items():
            output[(year, exam_number, subject)] = {
                "answers": [answer_tokens_to_list(x) for x in data["answers"]],
                "source": data.get("answerSource", "補充答案整理"),
                "url": data.get("answerSourceUrl", ""),
                "file": "answer-key-overrides.json",
            }
        if all((year, exam_number, subject) in output for subject in SUBJECTS):
            continue

        grouped_candidates = []
        single_subject_candidates = defaultdict(list)
        for path, pages in docs:
            groups = answer_groups("\n".join(pages))
            if not groups:
                continue
            if len(groups) >= 3:
                grouped_candidates.append((path, groups))
            else:
                subject = identify_subject_from_name(path.name)
                if not subject:
                    subject = identify_subject("\n".join(pages[:2]))
                if subject:
                    for group in groups:
                        single_subject_candidates[subject].append((path, group))

        if grouped_candidates:
            path, groups = max(
                grouped_candidates,
                key=lambda item: (len(item[1]), item[0].parent == BANK_DIR),
            )
            for idx, subject in enumerate(SUBJECTS):
                if (year, exam_number, subject) not in output and idx < len(groups):
                    output[(year, exam_number, subject)] = {
                        "answers": [groups[idx].get(n, []) for n in range(1, 51)],
                        "source": answer_source_label(path),
                        "url": "",
                        "file": pdf_source_path(path),
                    }
        for subject, candidates in single_subject_candidates.items():
            if (year, exam_number, subject) in output:
                continue
            path, group = candidates[0]
            output[(year, exam_number, subject)] = {
                "answers": [group.get(n, []) for n in range(1, 51)],
                "source": answer_source_label(path),
                "url": "",
                "file": pdf_source_path(path),
            }
    return output


def q_key(record):
    return record["year"], record["session"], record["subject"], record["number"]


def pdf_source_path(path: Path) -> str:
    try:
        return path.relative_to(SOURCE_ROOT).as_posix()
    except ValueError:
        return path.relative_to(DIST).as_posix()


def answer_source_label(path: Path) -> str:
    return "證基會官方標準答案 PDF" if path.parent == BANK_DIR else "試題 PDF 隨附答案表"


def label_session(year: int, session: int) -> str:
    return f"{year}年第{session}次"


def build_bank():
    overrides = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8"))
    candidates, raw_answer_docs, pdf_count = gather_pdf_sources()
    selected = {key: choose_question(items) for key, items in candidates.items()}
    keys = build_keys(raw_answer_docs, overrides)

    sessions = sorted({(year, session) for year, session, _, _ in selected}, reverse=True)
    if len(sessions) != 37:
        raise SystemExit(f"預期 37 個考試場次，解析到 {len(sessions)}：{sessions}")

    questions = []
    missing = []
    incomplete = []
    for year, session in sorted(sessions):
        for subject in SUBJECTS:
            answers = keys.get((year, session, subject))
            subject_questions = [selected.get((year, session, subject, n)) for n in range(1, 51)]
            if not answers or len(answers["answers"]) != 50 or any(not ans for ans in answers["answers"]):
                missing.append(f"{year}{session:02d} {subject}")
                continue
            if any(q is None for q in subject_questions):
                absent = [str(i + 1) for i, q in enumerate(subject_questions) if q is None]
                incomplete.append(f"{year}{session:02d} {subject} 缺題 {','.join(absent)}")
                continue
            for q in subject_questions:
                answer_set = answers["answers"][q["number"] - 1]
                accepted = [letter for letter in "ABCD" if letter in answer_set]
                if not accepted:
                    incomplete.append(f"{year}{session:02d} {subject} 第{q['number']}題沒有可用答案")
                    continue
                source_id = f"sfi-senior-{year}{session:02d}-{SUBJECTS.index(subject) + 1:02d}-{q['number']:03d}"
                answer_policy = "any-accepted" if len(accepted) > 1 else "single"
                source_label = answers["source"]
                if answers["url"]:
                    answer_source = {"name": source_label, "url": answers["url"]}
                else:
                    answer_source = {"name": source_label, "file": answers["file"]}
                options = [
                    {"option": text, "answer": letter in accepted}
                    for letter, text in zip("ABCD", q["options"])
                ]
                session_label = label_session(year, session)
                remark = f"題目來源：{q['file']}（PDF 第{','.join(map(str, q['pages']))}頁）；答案來源：{source_label}"
                questions.append({
                    "sn": f"{q['number']:03d}",
                    "class": f"{session_label}－{subject}",
                    "question": q["question"],
                    "options": options,
                    "remark": remark,
                    "felo": "",
                    "pic": "",
                    "answerPolicy": answer_policy,
                    "points": 2,
                    "sourceId": source_id,
                    "source": {
                        "id": source_id,
                        "kind": "past-exam",
                        "examYear": year + 1911,
                        "examSession": session,
                        "subject": subject,
                        "questionNumber": q["number"],
                        "questionFile": q["file"],
                        "questionPages": q["pages"],
                        "answerSource": answer_source,
                        "acceptedOptions": ["ABCD".index(letter) + 1 for letter in accepted],
                    },
                })

    if missing or incomplete:
        for item in missing[:40]:
            print("MISSING KEY:", item)
        for item in incomplete[:80]:
            print("INCOMPLETE:", item)
        raise SystemExit(f"答案缺漏 {len(missing)} 組，題目／答案格式異常 {len(incomplete)} 項，暫不輸出")

    questions.sort(key=lambda q: (q["source"]["examYear"], q["source"]["examSession"], SUBJECTS.index(q["source"]["subject"]), q["source"]["questionNumber"]))
    OUTPUT_PATH.write_text(
        "window.SECURITIES_SENIOR_OFFLINE_QUESTIONS = "
        + json.dumps(questions, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )

    counts = defaultdict(int)
    for q in questions:
        counts[q["source"]["subject"]] += 1
    files = [
        {"file": "00_全部考古題.txt", "label": f"全部考古題（{len(questions):,}題）"},
        {"file": "01_投資學_全部.txt", "label": f"投資學（{counts[SUBJECTS[0]]:,}題）"},
        {"file": "02_財務分析_全部.txt", "label": f"財務分析（{counts[SUBJECTS[1]]:,}題）"},
        {"file": "03_證券交易相關法規與實務_全部.txt", "label": f"證券交易相關法規與實務（{counts[SUBJECTS[2]]:,}題）"},
        {"file": "04_近三次全科.txt", "label": "近三次全科（450題）"},
    ]
    for year, session in sessions:
        files.append({"file": f"{year}{session:02d}_全科.txt", "label": f"{label_session(year, session)}（150題）"})
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    manifest = [item for item in manifest if item.get("category") != "證券商高級業務員"]
    manifest.append({"category": "證券商高級業務員", "files": files})
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"PDF sources: {pdf_count}; sessions: {len(sessions)}; total: {len(questions)}")
    for subject in SUBJECTS:
        print(f"{subject}: {counts[subject]}")
    print(f"Wrote: {OUTPUT_PATH}")


if __name__ == "__main__":
    build_bank()
