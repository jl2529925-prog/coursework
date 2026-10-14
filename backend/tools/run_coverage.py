from __future__ import annotations

import ast
import json
import sys
import trace
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
PACKAGE = ROOT / "personal_finance_api"


def executable_lines(path: Path) -> set[int]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    lines: set[int] = set()
    for node in ast.walk(tree):
        if hasattr(node, "lineno") and not isinstance(node, (ast.Import, ast.ImportFrom)):
            lines.add(node.lineno)
    return lines


def main() -> int:
    sys.path.insert(0, str(ROOT))
    suite = unittest.defaultTestLoader.discover(str(ROOT / "tests"))
    runner = unittest.TextTestRunner(verbosity=2)
    tracer = trace.Trace(count=True, trace=False)
    result = tracer.runfunc(runner.run, suite)
    counts = tracer.results().counts

    per_file = []
    total_executable = 0
    total_hit = 0
    for path in sorted(PACKAGE.glob("*.py")):
        executable = executable_lines(path)
        resolved = str(path.resolve())
        hit = {line for (filename, line), count in counts.items() if count and str(Path(filename).resolve()) == resolved}
        covered = len(executable & hit)
        total = len(executable)
        total_executable += total
        total_hit += covered
        per_file.append({"file": path.name, "covered": covered, "executable": total, "percent": round(covered / total * 100, 1) if total else 100.0})

    payload = {
        "method": "Python standard-library trace plus AST executable-line approximation",
        "tests_run": result.testsRun,
        "failures": len(result.failures),
        "errors": len(result.errors),
        "covered": total_hit,
        "executable": total_executable,
        "percent": round(total_hit / total_executable * 100, 1) if total_executable else 100.0,
        "files": per_file,
    }
    output = ROOT / "test-results"
    output.mkdir(exist_ok=True)
    (output / "coverage-summary.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload, indent=2))
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())

