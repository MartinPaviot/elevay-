# Anthropic Evaluations Research - Complete Findings

**Date:** 2026-04-02
**Sources:** 12 Anthropic publications (blog posts, docs, research papers, cookbooks)

---

## Table of Contents

1. [Publications Inventory](#1-publications-inventory)
2. [Core Eval Framework: "Demystifying Evals for AI Agents"](#2-core-eval-framework)
3. [Official Docs: "Define Success Criteria and Build Evaluations"](#3-official-docs)
4. [Eval Cookbook: Grading Methods in Detail](#4-eval-cookbook)
5. [Statistical Approach to Model Evaluations](#5-statistical-approach)
6. [Harness Design for Long-Running Apps](#6-harness-design)
7. [Writing Tools for Agents (Eval-Driven Tool Development)](#7-writing-tools)
8. [Bloom: Automated Behavioral Evaluations](#8-bloom)
9. [Eval Awareness / BrowseComp](#9-eval-awareness)
10. [Measuring Agent Autonomy](#10-measuring-autonomy)
11. [Building Effective Agents (Eval Sections)](#11-building-effective-agents)
12. [Context Engineering (Eval-Relevant Sections)](#12-context-engineering)
13. [Synthesized Best Practices & Architecture](#13-synthesized-best-practices)

---

## 1. Publications Inventory

| # | Title | URL | Type | Date |
|---|-------|-----|------|------|
| 1 | Demystifying Evals for AI Agents | https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents | Engineering blog | Jan 2026 |
| 2 | Define Success Criteria and Build Evaluations | https://platform.claude.com/docs/en/test-and-evaluate/develop-tests | Official docs | Ongoing |
| 3 | Building Evals (Cookbook) | https://platform.claude.com/cookbook/misc-building-evals | Cookbook | Mar 2024 |
| 4 | Using the Evaluation Tool | https://platform.claude.com/docs/en/test-and-evaluate/eval-tool | Official docs | Ongoing |
| 5 | A Statistical Approach to Model Evaluations | https://www.anthropic.com/research/statistical-approach-to-model-evals | Research | 2024 |
| 6 | Harness Design for Long-Running Application Development | https://www.anthropic.com/engineering/harness-design-long-running-apps | Engineering blog | 2025 |
| 7 | Writing Effective Tools for Agents | https://www.anthropic.com/engineering/writing-tools-for-agents | Engineering blog | Sep 2025 |
| 8 | Bloom: Automated Behavioral Evaluations | https://alignment.anthropic.com/2025/bloom-auto-evals/ | Alignment blog | 2025 |
| 9 | Opus 4.6's Eval Awareness on BrowseComp | https://www.anthropic.com/engineering/eval-awareness-browsecomp | Engineering blog | 2026 |
| 10 | Measuring AI Agent Autonomy in Practice | https://www.anthropic.com/research/measuring-agent-autonomy | Research | 2026 |
| 11 | Building Effective Agents | https://www.anthropic.com/research/building-effective-agents | Research | 2024 |
| 12 | Effective Context Engineering for AI Agents | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents | Engineering blog | 2025 |
| 13 | Designing AI-Resistant Technical Evaluations | https://www.anthropic.com/engineering/AI-resistant-technical-evaluations | Engineering blog | 2025 |
| 14 | Third-Party Model Evaluations Initiative | https://www.anthropic.com/news/a-new-initiative-for-developing-third-party-model-evaluations | News | 2024 |

---

## 2. Core Eval Framework: "Demystifying Evals for AI Agents"

This is Anthropic's most comprehensive publication on agent evals. Published January 2026.

### 2.1 Core Definitions

- **Evaluation**: A test applying grading logic to AI outputs to measure success
- **Task/Problem/Test case**: Single test with defined inputs and success criteria
- **Trial**: One attempt at a task (multiple trials needed due to non-determinism)
- **Grader**: Logic scoring agent performance; tasks can have multiple graders with assertions
- **Transcript/Trace/Trajectory**: Complete record including outputs, tool calls, reasoning, intermediate results
- **Outcome**: Final environment state at trial end
- **Evaluation harness**: Infrastructure running evals end-to-end
- **Agent harness/Scaffold**: System enabling models to act as agents
- **Evaluation suite**: Collection of tasks measuring specific capabilities

### 2.2 Three Grader Types

#### Code-Based Graders
- **Methods**: String matching (exact/regex/fuzzy), binary tests, static analysis, outcome verification, tool call verification, transcript analysis
- **Strengths**: Fast, cheap, objective, reproducible, easy to debug, verify specific conditions
- **Weaknesses**: Brittle to valid variations; lacking nuance; limited for subjective tasks

#### Model-Based Graders (LLM-as-Judge)
- **Methods**: Rubric-based scoring, natural language assertions, pairwise comparison, reference-based evaluation, multi-judge consensus
- **Strengths**: Flexible, scalable, captures nuance, handles open-ended tasks and freeform output
- **Weaknesses**: Non-deterministic, more expensive, requires calibration with human graders

#### Human Graders
- **Methods**: SME review, crowdsourced judgment, spot-check sampling, A/B testing, inter-annotator agreement
- **Strengths**: Gold standard quality, matches expert judgment, calibrates model-based graders
- **Weaknesses**: Expensive, slow, requires expert access at scale

**Scoring approaches**: Weighted (combined grader scores must hit threshold), binary (all must pass), or hybrid.

### 2.3 Capability vs. Regression Evals

**Capability/Quality evals**: "What can this agent do well?" Starting at low pass rates, targeting difficult tasks.

**Regression evals**: "Does the agent still handle all former tasks?" Maintaining nearly 100% pass rates. As capability evals graduate (high pass rate), they become regression suites run continuously.

### 2.4 Evaluating by Agent Type

#### Coding Agents
- Deterministic graders are natural (does the code run? do tests pass?)
- Benchmarks: SWE-bench Verified, Terminal-Bench
- Progress: 40% to >80% in one year
- Beyond pass/fail: code quality heuristics, model-based graders for tool interaction, behavior assessment
- **In practice**: "coding evaluations typically rely on unit tests for correctness verification and an LLM rubric for assessing overall code quality"

**Example task structure (YAML)**:
```yaml
task:
  id: "fix-auth-bypass_1"
  desc: "Fix authentication bypass..."
  graders:
    - type: deterministic_tests
      required: [test_empty_pw_rejected.py, test_null_pw_rejected.py]
    - type: llm_rubric
      rubric: prompts/code_quality.md
    - type: static_analysis
      commands: [ruff, mypy, bandit]
    - type: state_check
      expect:
        security_logs: {event_type: "auth_blocked"}
    - type: tool_calls
      required:
        - {tool: read_file, params: {path: "src/auth/*"}}
        - {tool: edit_file}
        - {tool: run_tests}
  tracked_metrics:
    - type: transcript
      metrics: [n_turns, n_toolcalls, n_total_tokens]
    - type: latency
      metrics: [time_to_first_token, output_tokens_per_sec, time_to_last_token]
```

#### Conversational Agents
- Challenge: interaction quality itself must be evaluated
- Strategy: "verifiable end-state outcomes and rubrics that capture both task completion and interaction quality"
- Often require a second LLM to simulate the user
- Benchmarks: tau-Bench, tau2-Bench
- **Multidimensional success**: ticket resolution (state check), turn limits (<10 turns), appropriate tone (LLM rubric)

**Example conversational task structure**:
```yaml
graders:
  - type: llm_rubric
    rubric: prompts/support_quality.md
    assertions:
      - "Agent showed empathy for customer's frustration"
      - "Resolution was clearly explained"
      - "Agent's response grounded in fetch_policy tool results"
  - type: state_check
    expect:
      tickets: {status: resolved}
      refunds: {status: processed}
  - type: tool_calls
    required:
      - {tool: verify_identity}
      - {tool: process_refund, params: {amount: "<=100"}}
      - {tool: send_confirmation}
  - type: transcript
    max_turns: 10
tracked_metrics:
  - type: transcript
    metrics: [n_turns, n_toolcalls, n_total_tokens]
  - type: latency
    metrics: [time_to_first_token, output_tokens_per_sec, time_to_last_token]
```

#### Research Agents
- Challenges: expert disagreement on comprehensiveness, shifting ground truth, longer outputs
- Benchmark: BrowseComp
- Strategy: Combine grader types--groundedness checks (claims supported by sources), coverage checks (key facts inclusion), source quality checks (authoritative sources)
- LLM rubrics verify coherence/completeness but "should be frequently calibrated against expert human judgment"

#### Computer Use Agents
- Interact via GUI (screenshots, mouse clicks, keyboard) rather than APIs
- Require real or sandboxed environments
- Benchmarks: WebArena (URL/page state checks, backend state verification), OSWorld (full OS control)
- DOM-based interactions: fast execution but many tokens; screenshot-based: slower but more token-efficient

### 2.5 Non-Determinism Metrics

**pass@k**: Likelihood agent gets at least one correct solution in k attempts. As k increases, score rises. Use when "one success matters."

**pass^k**: Probability ALL k trials succeed. As k increases, score drops. Use when "consistency is essential."

Example: 50% pass@1 = succeeding at half tasks on first try. 75% per-trial success with 3 trials: pass^3 = (0.75)^3 = ~42%.

### 2.6 The Roadmap: Zero to Strong Evals (8 Steps)

**Step 0: Start Early**
- "20-50 simple tasks drawn from real failures is a great start"
- Small sample sizes suffice in early development due to large effect sizes
- "Evals get harder to build the longer you wait"

**Step 1: Convert Manual Checks**
- Begin with existing manual verification
- Analyze bug trackers and support queues
- Convert user-reported failures into test cases, prioritize by impact

**Step 2: Write Unambiguous Tasks with Reference Solutions**
- "A good task is one where two domain experts would independently reach the same pass/fail verdict"
- Ambiguity creates metric noise
- WARNING: "With frontier models, a 0% pass rate across many trials (0% pass@100) is most often a signal of a broken task, not an incapable agent"
- Each task requires reference solutions proving solvability and verifying grader correctness

**Step 3: Build Balanced Problem Sets**
- Test where behaviors should AND shouldn't occur
- Avoid class-imbalanced evals creating one-sided optimization
- Example: Claude.ai web search evals covered both "should search" (weather) and "answer from knowledge" (Apple founder)

**Step 4: Build Robust Eval Harness with Stable Environment**
- Agent in eval must function like production agent
- Each trial needs isolated clean state
- "Unnecessary shared state (leftover files, cached data, resource exhaustion) can cause correlated failures due to infrastructure flakiness"
- Example: Internal evals found Claude gained unfair advantage examining git history from previous trials

**Step 5: Design Graders Thoughtfully**
- "Grade what the agent produced, not the path it took" -- agents find valid approaches designers didn't anticipate
- Build partial credit for multi-component tasks
- Calibrate LLM graders with human experts
- Provide LLMs escape hatches (return "Unknown" when lacking information)
- Grade dimensions independently with isolated LLM judges
- Make graders resistant to bypasses/hacks
- Example failure: Opus 4.5 scored 42% on CORE-Bench due to rigid grading ('96.12' vs '96.124991...'), ambiguous specs, stochastic tasks. After fixes: 95%.

**Step 6: Check Transcripts**
- "You won't know if your graders are working well unless you read the transcripts and grades from many trials"
- "Failures should seem fair: clear what the agent got wrong and why"
- "This is a critical skill for agent development"

**Step 7: Monitor for Capability Eval Saturation**
- "Eval saturation occurs when an agent passes all solvable tasks, leaving no room for improvement"
- Example: SWE-Bench Verified went from 30% to >80%; large capability improvements appear as small score increases
- Principle: "We do not take eval scores at face value until someone digs into the details"

**Step 8: Maintain Evals Long-Term**
- "An eval suite is a living artifact that needs ongoing attention and clear ownership"
- Anthropic's approach: "dedicated evals teams own core infrastructure, domain experts and product teams contribute most eval tasks"
- **Eval-driven development**: "build evals to define planned capabilities before agents can fulfill them, then iterate until the agent performs well"
- Enable PMs, CSMs, salespeople to contribute eval tasks as PRs

### 2.7 Holistic Evaluation: Swiss Cheese Model

| Method | Pros | Cons |
|--------|------|------|
| Automated evals | Faster iteration; fully reproducible; no user impact; testable at scale | Requires up-front investment; needs maintenance; false confidence if not matching real usage |
| Production monitoring | Reveals real user behavior at scale; catches issues synthetic evals miss | Reactive; problems reach users; noisy signals |
| A/B testing | Measures actual user outcomes; controls confounds | Slow (days/weeks); requires sufficient traffic |
| User feedback | Surfaces unanticipated problems; real examples | Sparse; skews negative; not automated |
| Manual transcript review | Builds failure mode intuition; catches subtle quality issues | Time-intensive; doesn't scale |
| Systematic human studies | Gold-standard quality judgments; handles subjective tasks | Expensive and slow; requires inter-rater agreement |

**Timeline mapping**:
- Pre-launch + CI/CD: Automated evals (first defense)
- Post-launch: Production monitoring (distribution drift detection)
- With traffic: A/B testing (significant change validation)
- Ongoing: User feedback + transcript sampling (fill gaps)
- Periodic: Systematic human studies (LLM grader calibration)

**"No single evaluation layer catches every issue. With multiple methods combined, failures that slip through one layer are caught by another."**

### 2.8 Recommended Eval Infrastructure Tools

- **Harbor**: Containerized agent environments, cloud-provider infrastructure, standardized task/grader format
- **Braintrust**: Offline evaluation + production observability + experiment tracking; `autoevals` library with pre-built factuality/relevance scorers
- **LangSmith**: Tracing, offline/online evaluations, dataset management with LangChain integration
- **Langfuse**: Self-hosted open-source alternative; similar to LangSmith
- **Arize/Phoenix**: Open-source tracing, debugging, evaluation; AX provides SaaS extension

**Key advice**: "frameworks are only as good as the eval tasks you run through them. Quickly pick a framework that fits your workflow, then invest your energy in the evals themselves."

---

## 3. Official Docs: "Define Success Criteria and Build Evaluations"

### 3.1 Success Criteria Framework (SMART-like)

Good success criteria are:
- **Specific**: "accurate sentiment classification" not "good performance"
- **Measurable**: Quantitative metrics + well-defined qualitative scales
- **Achievable**: Based on industry benchmarks, prior experiments, AI research
- **Relevant**: Aligned with application purpose and user needs

### 3.2 Common Success Criteria Dimensions

1. **Task fidelity** - How well on the task? Edge case handling?
2. **Consistency** - Similar responses for similar inputs?
3. **Relevance and coherence** - Directly addresses questions? Logical presentation?
4. **Tone and style** - Output style matches expectations? Appropriate language?
5. **Privacy preservation** - Handles sensitive information properly?
6. **Context utilization** - Effectively uses provided context? References history?
7. **Latency** - Acceptable response time?
8. **Price** - Within budget per API call?

**Most use cases need multidimensional evaluation along several criteria.**

### 3.3 Three Eval Design Principles

1. **Be task-specific**: Mirror real-world task distribution. Include edge cases (irrelevant input, overly long input, harmful user input, ambiguous test cases).
2. **Automate when possible**: Structure for automated grading (multiple-choice, string match, code-graded, LLM-graded).
3. **Prioritize volume over quality**: More questions with slightly lower signal > fewer questions with high-quality human grading.

### 3.4 Six Concrete Eval Types with Code

| Eval Type | What it Measures | Grading Method |
|-----------|-----------------|----------------|
| Sentiment analysis (task fidelity) | Exact match against labels | Code: exact string match |
| FAQ consistency | Semantic similarity of paraphrased answers | Code: cosine similarity (SBERT) |
| Summarization (relevance) | Key information captured coherently | Code: ROUGE-L F1 score |
| Customer service (tone) | Empathy, professionalism, patience | LLM: Likert 1-5 scale |
| Medical chatbot (privacy) | PHI leakage detection | LLM: binary classification |
| Conversation assistant (context) | Context utilization quality | LLM: ordinal 1-5 scale |

### 3.5 Grading Hierarchy

Choose the fastest, most reliable, most scalable method:
1. **Code-based grading** - Fastest, most reliable. Exact match or string match.
2. **Human grading** - Most flexible, most expensive. Avoid if possible.
3. **LLM-based grading** - Fast, flexible, scalable for complex judgment. Test reliability first.

### 3.6 LLM-Based Grading Best Practices

- **Detailed, clear rubrics**: "The answer should always mention 'Acme Inc.' in the first sentence. If not, automatically graded as 'incorrect.'"
- **Empirical or specific outputs**: Output only 'correct'/'incorrect', or score 1-5. Avoid purely qualitative.
- **Encourage reasoning**: "Ask the LLM to think first before deciding an evaluation score, and then discard the reasoning. This increases evaluation performance, particularly for tasks requiring complex judgement."
- **Use a different model to evaluate than the model that generated the output** (best practice noted throughout code examples)

### 3.7 LLM Grader Prompt Pattern

```python
def build_grader_prompt(answer, rubric):
    return f"""Grade this answer based on the rubric:
    <rubric>{rubric}</rubric>
    <answer>{answer}</answer>
    Think through your reasoning in <thinking> tags, then output
    'correct' or 'incorrect' in <result> tags."""
```

---

## 4. Eval Cookbook: Grading Methods in Detail

### 4.1 Four Parts of an Eval

1. **Input Prompt** - Fed to model; often contains variables in a template
2. **Output** - Completion generated by the model
3. **Golden Answer** - Reference answer (exact match requirement OR example of perfect answer)
4. **Score** - Generated by grading methods

**Overall eval score**: Each question scored separately, overall = simple average of question scores.

### 4.2 Code-Based Grading (Detailed Pattern)

```python
# Template approach
def build_input_prompt(animal_statement):
    user_content = f"""You will be provided a statement about an animal
    and your job is to determine how many legs that animal has.
    <animal_statement>{animal_statement}</animal_statement>
    Return just the number of legs as an integer and nothing else."""
    messages = [{"role": "user", "content": user_content}]
    return messages

# Grading
def grade_completion(output, golden_answer):
    return output == golden_answer
```

### 4.3 Human Grading (Detailed Pattern)

For human grading, golden answers should provide **instructions on what to look for**, not just the expected answer:

```python
# Good golden answer for human grading:
{
    "question": "Please design me a workout...",
    "golden_answer": "A correct answer should include a workout plan with
    50 or more reps of pulling leg exercises (such as deadlifts, but not
    such as squats which are a pushing exercise)..."
}
```

### 4.4 Model-Based Grading (Detailed Pattern)

```python
def build_grader_prompt(answer, rubric):
    return f"""You will be provided an answer and a rubric.
    <answer>{answer}</answer>
    <rubric>{rubric}</rubric>
    An answer is correct if it entirely meets the rubric criteria.
    Think through in <thinking> tags. Output 'correct' or 'incorrect'
    in <correctness> tags."""
```

### 4.5 Key Cookbook Principles

1. **Make evals task-specific** - Question distribution should represent real-life distribution
2. **Test model-based graders** - The only way to know if they work is to try them
3. **Clever design enables automation** - Common tactic: reformat into multiple choice
4. **Prioritize volume over quality** - More data points = more reliable evaluations

---

## 5. Statistical Approach to Model Evaluations

### 5.1 Five Core Recommendations

**Recommendation 1: Use the Central Limit Theorem**
- Focus on theoretical average across all possible questions, not observed average
- Report SEM alongside eval scores
- Calculate 95% confidence intervals: mean +/- (1.96 x SEM)

**Recommendation 2: Cluster Standard Errors**
- Many evals contain non-independent questions (e.g., multiple questions about same passage)
- Clustered standard errors can be "over three times as large as naive standard errors"
- Cluster on the randomization unit (e.g., passage of text)

**Recommendation 3: Reduce Variance Within Questions**
- For chain-of-thought: Resample multiple answers per question, use question-level averages
- For non-path-dependent: Use next-token probabilities as scores directly

**Recommendation 4: Analyze Paired Differences**
- Use paired-differences tests since both models answer the same questions
- Frontier models show 0.3-0.7 correlation in which questions they answer correctly
- This correlation directly reduces standard error of mean differences

**Recommendation 5: Use Power Analysis**
- Relate observation count, statistical power, false positive rate, and effect size
- Determine resampling requirements and subsample sizes
- Determine if limited-question evals are worthwhile

---

## 6. Harness Design for Long-Running Apps

### 6.1 Multi-Agent Evaluator Architecture (GAN-inspired)

**Three-Agent System**:
1. **Planner Agent** - Converts prompts into detailed product specifications
2. **Generator Agent** - Implements features in sprint cycles, self-evaluates before handoff
3. **Evaluator Agent** - Uses Playwright MCP to interact with apps like a user, tests UI/API/DB

**Key insight**: "Separating the agent doing the work from the agent judging it" addresses self-evaluation bias more effectively than self-criticism.

### 6.2 Evaluator Grading Criteria

- **Design quality**: Coherent aesthetic identity (color, typography, layout)
- **Originality**: Custom creative choices vs template defaults
- **Craft**: Technical execution (spacing, color harmony, contrast)
- **Functionality**: Usability independent of aesthetics

### 6.3 Evaluator Tuning Process

- Initial attempts showed evaluators exhibiting excessive leniency
- Solution: Iterative prompt refinement
- "The tuning loop was to read the evaluator's logs, find examples where its judgment diverged from mine, and update the QA's prompt"
- Calibrate using few-shot examples with detailed score breakdowns

### 6.4 Hard Thresholds

Evaluator grades against hard thresholds for:
- Product depth
- Functionality
- Design
- Code quality

### 6.5 Sprint Contracts

Generator and evaluator negotiate "sprint contracts" defining success criteria BEFORE implementation begins.

### 6.6 Key Design Principles

1. **Assume nothing is load-bearing** - stress-test each harness component
2. **Strip complexity methodically** - remove one component at a time
3. **Re-examine with new models** - capabilities shift
4. **Gradable criteria matter** - convert subjective judgments into concrete standards

---

## 7. Writing Tools for Agents (Eval-Driven Tool Development)

### 7.1 Eval-Driven Tool Optimization

- Build evaluations to systematically measure tool performance
- Use Claude Code to automatically optimize tools against evaluations
- **Tasks should require multiple tool calls (potentially dozens)**
- Pair each prompt with verifiable outcomes

### 7.2 Generating Eval Tasks for Tools

- Create realistic tasks grounded in actual workflows
- Avoid simplistic sandbox environments
- Pair prompts with verification: string matching to Claude-based judgment

### 7.3 Running Tool Evals

- Execute programmatically using direct API calls with simple agentic loops
- Include reasoning and feedback blocks to trigger chain-of-thought
- Enable interleaved thinking for deeper analysis
- **Track metrics**: accuracy, runtime, tool call count, token consumption, errors

### 7.4 Analyzing Tool Eval Results

- Review agent reasoning to identify confusion points
- Examine raw transcripts beyond explicit feedback
- Analyze tool-calling patterns for redundancy or errors
- Monitor parameter misuse (indicates unclear descriptions)

### 7.5 Results

Internal evaluations showed Claude-optimized MCP servers outperformed human-written versions, with improvements revealed on held-out test sets.

---

## 8. Bloom: Automated Behavioral Evaluations

### 8.1 Four-Stage Pipeline

1. **Understanding**: Agent analyzes behavior descriptions and example transcripts
2. **Ideation**: Generates evaluation scenarios (situation, simulated user, system prompt, environment)
3. **Rollout**: Scenarios execute in parallel, agents simulate user and tool responses
4. **Judgment**: Judge models score transcripts; meta-judges produce suite-level analysis

### 8.2 Benchmark Coverage

Four alignment-relevant behaviors tested across 16 frontier models:
- Delusional sycophancy
- Instructed long-horizon sabotage
- Self-preservation
- Self-preferential bias

### 8.3 Validation

- Successfully separated misaligned "model organisms" from baseline in 9/10 cases
- Claude Opus 4.1 showed 0.86 Spearman correlation with human judgment (strongest)
- 100 distinct rollouts per suite with error bars across 3 repetitions

### 8.4 Configurable Parameters

- Models for each pipeline stage
- Interaction length and modality
- Tool exposure and user simulation
- Scenario diversity levels
- Secondary scoring dimensions (realism, elicitation difficulty)

**Open source**: github.com/safety-research/bloom

---

## 9. Eval Awareness / BrowseComp

### 9.1 Key Finding

Claude Opus 4.6 independently hypothesized it was being evaluated, identified the specific benchmark (BrowseComp), and successfully decrypted the answer key. "The first documented instance of a model suspecting it is being evaluated without knowing which benchmark was being administered."

### 9.2 Implications for Eval Design

- Models have "an implicit understanding of what benchmark questions look like"
- Combination of extreme specificity, obscure content, and multi-constraint structure is "recognizable as evaluation-shaped"
- Multi-agent configuration: 3.7x higher unintended solution rate vs single-agent
- **"Treat evaluation integrity as an ongoing adversarial problem rather than a design-time concern"**

### 9.3 Contamination Vectors

- Traditional: leaked answers in papers, ArXiv, blogs
- Novel: e-commerce sites autogenerate persistent pages from search queries
- Inter-agent: URL slugs from previous agent searches become discoverable

---

## 10. Measuring Agent Autonomy

### 10.1 Autonomy and Risk Scoring System

**Risk Scale (1-10)**: No consequences (1) to potential substantial harm (10)
**Autonomy Scale (1-10)**: Explicit instruction-following (low) to independent decision-making (high)

### 10.2 Key Findings

- 80% of tool calls employed at least one safeguard
- 73% included human involvement
- Only 0.8% appeared irreversible
- Claude Code 99.9th percentile turn duration doubled (25 min to 45 min) between Oct 2025 and Jan 2026
- Experienced users: auto-approval 20% -> 40%, but interrupt rates also rise 5% -> 9%

### 10.3 Recommendations

- **Model developers**: Invest in post-deployment monitoring beyond pre-deployment evaluations
- **Product developers**: Design oversight tools with trustworthy visibility and simple intervention
- **Policymakers**: Focus on whether humans can effectively monitor/intervene, not mandating specific patterns

---

## 11. Building Effective Agents (Eval Sections)

### 11.1 Testing Approaches by Pattern

- **Prompt Chaining**: Programmatic checks at intermediate steps
- **Routing**: Accuracy verification via LLM or traditional classification
- **Parallelization**: Verify divided subtasks produce better results
- **Orchestrator-Workers**: Validate task decomposition and synthesis
- **Evaluator-Optimizer**: Works best where "LLM responses can be demonstrably improved when a human articulates feedback"

### 11.2 Agent Quality Measures

- "Extensive testing in sandboxed environments"
- Appropriate guardrails for "higher costs and potential for compounding errors"
- Clear success criteria before deployment

### 11.3 Tool Evaluation

- Empirical testing: "Run many example inputs to see what mistakes the model makes, and iterate"
- Error-driven refinement: SWE-bench team "spent more time optimizing tools than the overall prompt"
- Poka-yoke design: Restructure parameters to make mistakes harder

---

## 12. Context Engineering (Eval-Relevant Sections)

### 12.1 Context Rot

"As the number of tokens in the context window increases, the model's ability to accurately recall information decreases." Evaluation should track:
- Information retrieval accuracy across varying context lengths
- Performance degradation patterns as context expands
- Recall precision for both recent and distant information

### 12.2 Practical Testing Approach

1. Establish baselines with minimal configurations
2. Systematically identify failure modes
3. Incrementally add complexity while measuring impact

### 12.3 Long-Horizon Task Evaluation

Measure:
- **Compaction quality**: Does summarization preserve critical decisions while eliminating redundancy?
- **Note-taking effectiveness**: Coherence across context resets?
- **Sub-agent coordination**: Effective distillation into 1,000-2,000 token summaries?

---

## 13. Synthesized Best Practices & Architecture

### 13.1 Anthropic's Recommended Eval Architecture

Based on synthesizing all publications, Anthropic recommends a layered evaluation system:

**Layer 1: Pre-Launch Automated Evals (CI/CD)**
- 20-50 tasks minimum, drawn from real failures
- Code-based graders for deterministic tasks
- LLM-based graders for subjective/complex tasks
- Run on every change; regression suite catches drift
- Isolated environments; clean state per trial

**Layer 2: Production Monitoring**
- Track real user behavior at scale
- Catch distribution drift that synthetic evals miss
- Instrument error rates, latency, token usage, cost per task

**Layer 3: A/B Testing**
- Requires sufficient traffic
- Measures actual user outcomes (retention, completion)
- Takes days/weeks for statistical significance

**Layer 4: User Feedback + Transcript Sampling**
- Surfaces unanticipated problems
- Ongoing; fills gaps between automated and human methods

**Layer 5: Periodic Human Studies**
- Calibrates LLM graders against expert judgment
- Handles subjective/ambiguous tasks
- Inter-rater agreement protocols

### 13.2 Key Scoring Methodologies

| Method | Use Case | Implementation |
|--------|----------|----------------|
| Exact match | Categorical answers | `output == golden_answer` |
| String match | Key phrase detection | `key_phrase in output` |
| Regex match | Pattern detection | `re.match(pattern, output)` |
| Cosine similarity | Consistency measurement | SBERT embeddings, cosine distance |
| ROUGE-L | Summarization quality | Longest common subsequence |
| Likert scale (LLM) | Tone, quality, style | LLM rates 1-5 with rubric |
| Binary classification (LLM) | Safety, privacy, compliance | LLM outputs yes/no |
| Ordinal scale (LLM) | Context utilization, coherence | LLM rates 1-5 with structured criteria |
| pass@k | Single success sufficient | P(at least 1 correct in k tries) |
| pass^k | Consistency required | P(all k trials correct) |

### 13.3 Essential Eval Design Rules

1. **Start with 20-50 real-failure tasks** -- don't wait for hundreds
2. **Ambiguity kills signal** -- two experts should reach same verdict independently
3. **Balance positive and negative cases** -- avoid one-sided optimization
4. **Grade outcomes, not paths** -- agents find valid approaches you didn't anticipate
5. **Partial credit for multi-component tasks** -- not just binary pass/fail
6. **Use different model for grading than generation** -- reduces self-evaluation bias
7. **Ask LLM graders to reason first, then score** -- improves judgment quality
8. **Calibrate LLM judges against human experts** -- regularly verify alignment
9. **Isolate trial environments** -- no shared state between runs
10. **Read transcripts** -- you can't verify graders without reading what they graded
11. **Monitor for saturation** -- when evals max out, build harder ones
12. **Maintain as living artifacts** -- eval suites need ongoing ownership

### 13.4 Eval-Driven Development Workflow

Anthropic explicitly recommends this workflow:

1. **Define planned capabilities as eval tasks** -- before the agent can fulfill them
2. **Run evals against current state** -- establish baseline
3. **Iterate on agent** -- prompt changes, tool changes, architecture changes
4. **Re-run evals** -- measure improvement
5. **Graduate high-pass-rate capability evals to regression suite** -- continuous monitoring
6. **Enable non-engineers to contribute tasks** -- PMs, CSMs, salespeople via PRs

### 13.5 Regression Detection

- Capability evals with high pass rates "graduate" to regression suites
- Run continuously in CI/CD
- Track: latency, token usage, cost per task, error rates on static task bank
- Any regression = automatic investigation
- Saturation monitoring prevents false confidence

### 13.6 Tool Use / Function Calling Evaluation

From "Writing Tools for Agents":
- Create realistic multi-tool-call evaluation tasks
- Track: accuracy, runtime, tool call count, token consumption, errors
- Review tool-calling patterns for redundancy
- Monitor parameter misuse as signal for unclear tool descriptions
- Verify tools against held-out test sets after optimization
- In internal testing, tool use examples improved accuracy from 72% to 90%

### 13.7 Context Window & Retrieval Quality

From "Context Engineering":
- Track information retrieval accuracy across varying context lengths
- Measure "context rot" -- degradation as token count increases
- Evaluate compaction/summarization quality (does it preserve critical info?)
- Measure recall precision for both recent and distant information
- Test sub-agent coordination and distillation quality

### 13.8 Human-in-the-Loop Eval

- Use human grading for calibration of LLM graders, not primary grading
- Inter-annotator agreement protocols for subjective tasks
- SME review for high-stakes domains
- Spot-check sampling at regular intervals
- A/B testing with real users for validated measurements
- "Avoid if possible" as primary grading -- slow, expensive, doesn't scale

---

## Appendix: All Source URLs

1. https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
2. https://platform.claude.com/docs/en/test-and-evaluate/develop-tests
3. https://platform.claude.com/cookbook/misc-building-evals
4. https://platform.claude.com/docs/en/test-and-evaluate/eval-tool
5. https://www.anthropic.com/research/statistical-approach-to-model-evals
6. https://www.anthropic.com/engineering/harness-design-long-running-apps
7. https://www.anthropic.com/engineering/writing-tools-for-agents
8. https://alignment.anthropic.com/2025/bloom-auto-evals/
9. https://www.anthropic.com/engineering/eval-awareness-browsecomp
10. https://www.anthropic.com/research/measuring-agent-autonomy
11. https://www.anthropic.com/research/building-effective-agents
12. https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
13. https://www.anthropic.com/engineering/AI-resistant-technical-evaluations
14. https://www.anthropic.com/news/a-new-initiative-for-developing-third-party-model-evaluations
