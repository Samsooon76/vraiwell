# Agent Workflow

This repository uses specialized agents to implement features safely and efficiently.

The main agent should delegate tasks to the appropriate specialist agents.

---

# Agents

## architect

Role: System design and implementation planning.

Responsibilities:
- Understand the goal of the feature
- Analyze the repository architecture
- Identify impacted modules
- Define the implementation plan
- Identify risks and edge cases

Rules:
- Do NOT write code
- Only produce a clear step-by-step implementation plan


---

## explorer

Role: Repository analysis.

Responsibilities:
- Explore the codebase
- Identify relevant files and modules
- Explain how the existing system works
- Locate where changes should occur

Rules:
- Do not modify files
- Focus on understanding and mapping the code


---

## implementer

Role: Code implementation.

Responsibilities:
- Implement features defined by the architect
- Follow existing project patterns
- Write clean and minimal code
- Keep changes focused

Rules:
- Do not refactor unrelated code
- Do not redesign architecture


---

## reviewer

Role: Code quality and safety.

Responsibilities:
- Detect bugs and edge cases
- Identify security issues
- Suggest performance improvements
- Improve readability and maintainability

Rules:
- Do not rewrite the entire feature
- Focus on critical improvements


---

## tester

Role: Test generation and validation.

Responsibilities:
- Write unit tests
- Add integration tests when needed
- Cover edge cases
- Prevent regressions

Rules:
- Follow the project's testing framework
- Prioritize critical logic paths


---

# Execution Workflow

All tasks should follow this order:

1. architect → design implementation plan
2. explorer → locate relevant files
3. implementer → implement code
4. reviewer → review the implementation
5. tester → add tests

---

# General Rules

- Prefer simple and maintainable solutions
- Avoid unnecessary abstractions
- Follow existing project conventions
- Keep commits small and focused