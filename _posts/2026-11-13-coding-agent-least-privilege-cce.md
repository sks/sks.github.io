---
layout: post
title: "The Agent Wrote the Code. Least Privilege Is Still Your Job."
date: 2026-11-13 13:30:00 -0800
description: "Coding agents can add cloud APIs faster than IAM review. Use CCE to inventory calls, detect privilege drift, and enforce least privilege."
image: /assets/images/og-governance.png
tags: [ai-agents, ai-coding, cce, security, least-privilege, iam, platform-engineering]
---

A coding agent can add an Amazon Simple Storage Service (S3) integration before I have finished writing the Identity and Access Management (IAM) ticket. That speed is why I use it. It is also why I do not want the deployment fix to be “just give it `s3:*` for now.”

The agent did its job: it wrote plausible code, wired the software development kit (SDK), and made the tests pass. **Security is still a critical engineering responsibility.** Someone has to determine which operations the application needs, which resources it may touch, and whether this pull request quietly changed that answer.

That is the problem [Code Context Engine (CCE)](https://appcd-dev.github.io/cce/) helps with. CCE statically analyzes source code and turns cloud SDK calls into structured, reviewable evidence: provider, resource, operation, file, line, and enclosing function. It gives me a concrete starting point for least-privilege review without asking a large language model (LLM) to read the entire repository and guess.

**Key takeaways**

- The principle of least privilege (POLP) limits damage from mistakes as well as attacks; coding agents make both easier to scale.
- The agent's credentials and the generated application's cloud role are separate privilege planes. Both need controls.
- Sending a whole repository to an LLM is not a durable way to discover or enforce permissions.
- CCE turns visible SDK calls into candidate entitlements and can flag new mapped call sites in continuous integration (CI). Humans still review resource scope and effective IAM.
{: .key-takeaways}

## Coding changed. Authorization did not.

Consider a familiar request:

> Add a feature that downloads an artifact from S3 and uploads a processed copy.

The agent edits a few files and adds `GetObject` and `PutObject`. Unit tests use a mock client. Everything looks clean.

Then deployment fails with `AccessDenied`.

Under time pressure, the difference between these two policies is enormous:

```text
s3:GetObject + s3:PutObject on the required bucket and key prefixes
```

versus:

```text
s3:* on every bucket the role can reach
```

The first requires understanding the code and its deployment boundary. The second makes the error go away by expanding the blast radius. Development assisted by artificial intelligence (AI) makes this tension more common because it reduces the cost of adding an SDK call to almost nothing. It does not reduce the cost of getting authorization wrong.

This is not an argument against coding agents. It is an argument for giving their output the same security engineering we owe any other code—and for automating the evidence collection that slows that review down.

## POLP was designed for fallible systems, not perfect operators

The principle of least privilege is not a new response to generative AI. Jerome H. Saltzer and Michael D. Schroeder articulated it in their 1975 paper, [*The Protection of Information in Computer Systems*](https://web.mit.edu/Saltzer/www/publications/protection/Basic.html):

> Every program and every user of the system should operate using the least set of privileges necessary to complete the job.

The next sentence matters just as much. Their first rationale was to limit damage from **an accident or error**. They also wanted fewer interactions among privileged programs and fewer programs to audit after suspected misuse.

That describes the coding-agent workflow remarkably well:

- The model can misunderstand a requirement.
- A generated convenience method can introduce a write operation into a read-only path.
- Repository text, an issue, or tool output can contain instructions the model should not follow.
- A human can approve a broad credential because narrowing it is tedious.

Least privilege does not assume malicious intent. It assumes that intent and outcome can diverge. An agent with write access can cause damage while trying to be helpful; an application role with `s3:*` can turn one generated bug into a much larger incident.

The [Open Worldwide Application Security Project (OWASP) Excessive Agency guidance](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) makes the modern version of this argument explicit: excessive functionality, excessive permissions, and excessive autonomy are distinct risks. Its recommended controls include minimum permissions and authorization in downstream systems rather than relying on the LLM to decide whether an action is allowed.

### There are two privilege planes to review

Teams often mix these together:

| Privilege plane | Example question | Useful controls |
|---|---|---|
| **The coding agent** | Can this session read private repositories, run shell commands, or push to `main`? | Repository scopes, short-lived credentials, sandboxing, tool allowlists, approval gates |
| **The application the agent changed** | Can this service read one bucket, write another prefix, or delete objects? | IAM actions, resource constraints, permission boundaries, deployment tests |

CCE addresses the **second plane**: source-level evidence for the application's cloud application programming interface (API) usage. It does not sandbox the coding agent or authorize the agent's own tool calls. For that runtime boundary, a policy engine belongs between the model and tool execution; I covered that in [Authorize AI agent tool calls with Open Policy Agent (OPA)](/blog/authorize-ai-agent-tool-calls-opa/).

Keeping the planes separate prevents a common mistake: making the coding agent read-only does not make the application it generated read-only.

## The security lapses are real—but the details matter

This is not hypothetical, and it is not all “the model went rogue.” Three disclosures show different failure modes:

- **GitHub Copilot Chat / CamoLeak:** [Legit Security's September 2025 research](https://www.legitsecurity.com/blog/camoleak-critical-github-copilot-vulnerability-leaks-private-source-code) demonstrated indirect prompt injection through a pull-request description and exfiltration of private source and secrets using the victim's Copilot context. Legit reported that GitHub fixed the issue in August 2025. The lesson is that untrusted repository content can act through the permissions of the person using the assistant.
- **Gemini CLI, a command-line interface (CLI):** [Tracebit's July 2025 disclosure](https://tracebit.com/blog/code-exec-deception-gemini-ai-cli-hijack) combined malicious repository content, shell-command allowlist weaknesses, and a misleading command display to demonstrate credential exfiltration while a user explored a codebase. Google fixed the issue in v0.1.14. The demonstration used the default no-sandbox mode; it was controlled research, not a reported real-world breach.
- **Amazon Q Developer for VS Code:** A [July 2025 bulletin from Amazon Web Services (AWS)](https://aws.amazon.com/security/security-bulletins/AWS-2025-015/) says an inappropriately scoped GitHub token in CodeBuild allowed an actor to commit malicious code that entered extension v1.84.0. AWS withdrew that release and replaced the credentials. The payload did not execute because of a syntax error. This was a supply-chain compromise around an AI coding product—and a direct credential-scoping failure—not an autonomous model attack.

The common denominator is not a particular vendor. **Content can be hostile, tools can be over-capable, and credentials can outgrow the task.** Patching one vulnerability does not remove the need for least privilege.

## “Give the LLM the whole repository” is not a POLP strategy

When an agent-generated change needs an IAM role, it is tempting to ask a model: “Here is the repository. What permissions does it need?”

That can produce a useful review note. It should not become the system of record.

### More context means more exposure

Repository-wide context can include proprietary code, credentials that should not have been committed, customer examples, and security-sensitive design details. Sending all of it to answer a narrow question violates data minimization before we even discuss authorization.

Context exclusions help, but they are not a security boundary. [GitHub's Copilot documentation](https://docs.github.com/en/copilot/concepts/security-governance-and-network-settings/content-exclusion) says exactly that and notes that indirect access and third-party Model Context Protocol (MCP) clients can bypass the guarantee teams might assume.

### A larger context window is not complete analysis

The [*Lost in the Middle*](https://aclanthology.org/2024.tacl-1.9/) study found that language-model performance could degrade when relevant information appeared in the middle of long contexts, even in models designed for long context. That was not an IAM study, but it defeats a dangerous assumption: **present in the prompt does not mean reliably found and used**.

Repositories also change. A repeatable permission baseline cannot depend on which files fit today, how the prompt was phrased, or whether the model noticed a wrapper in a different directory.

### Source text is also untrusted input

README files, tests, comments, fixtures, and dependency documentation can all carry prompt injection. Sending more repository text to an agent increases the material it must treat as data rather than instructions. A model summary of that material is not an authorization boundary.

### Permission discovery and permission enforcement are different jobs

Even a perfect natural-language inventory would not constrain the deployed role. I still need an IAM policy, resource rules, CI review, and runtime enforcement. The model cannot grant itself the authority to decide what the downstream cloud should allow.

The durable division of labor is:

1. Derive narrow, repeatable facts from source.
2. Review those facts against deployment policy.
3. Enforce the decision outside the model.
4. Diff the facts as the code changes.

That is where CCE fits.

## CCE: source calls in, reviewable evidence out

CCE is a Go CLI that uses tree-sitter to parse source, resolve SDK call names, and map them through YAML Ain't Markup Language (YAML) rules into `(provider, resource, operation)` tuples. The built-in mapper covers AWS, Azure, Google Cloud Platform (GCP), Oracle Cloud Infrastructure (OCI), IBM, and Alibaba. It supports Go, Java, Python, and JavaScript; polyglot repositories need one scan per language.

For a local folder scan, parsing happens locally and produces a local report. No LLM is required to extract the inventory:

```text
Agent- or human-written source
        │
        ▼
CCE: tree-sitter + mapping lenses
        │
        ├── JSON / SARIF call-site evidence
        ├── baseline diff for CI
        └── optional compact context for an LLM reviewer
        │
        ▼
Human-reviewed IAM actions + resource scope + deployment tests
```

The important word is **evidence**. CCE reports calls visible to static analysis. It does not claim to calculate effective permissions.

## Example 1: discover what the agent actually added

Suppose an agent changes an artifact handler so it reads one S3 object and writes a processed object:

```go
func Copy(ctx context.Context, client *s3.Client, bucket, src, dst string) error {
    obj, err := client.GetObject(ctx, &s3.GetObjectInput{
        Bucket: aws.String(bucket),
        Key:    aws.String(src),
    })
    if err != nil {
        return fmt.Errorf("get source artifact: %w", err)
    }
    defer obj.Body.Close()

    _, err = client.PutObject(ctx, &s3.PutObjectInput{
        Bucket: aws.String(bucket),
        Key:    aws.String(dst),
        Body:   obj.Body,
    })
    if err != nil {
        return fmt.Errorf("put processed artifact: %w", err)
    }
    return nil
}
```

Run CCE from the service root:

```bash
cce -folder . -language GO -filter cloud \
  -format json -output entitlements.json

jq -r '.entitlements[]
  | select(.resource == "s3")
  | "s3:\(.operation)"' entitlements.json | sort -u
```

For these visible calls, the relevant candidate actions are:

```text
s3:GetObject
s3:PutObject
```

The JavaScript Object Notation (JSON) report retains the call sites, so a reviewer can go back to the exact file and function rather than trusting a summary. The review is not finished: bucket and key scope, encryption requirements, SDK pagination, and deployment behavior still need attention. But the starting point is now `GetObject` plus `PutObject`, not a reflexive `s3:*`.

That is the first pain point CCE removes: **manually reconstructing cloud API usage by grepping a repository after the agent has changed it.**

## Example 2: make privilege drift visible in a pull request

A one-time inventory becomes stale immediately. Save a baseline before the change, scan the pull request, and compare them:

```bash
cce -folder . -language GO -filter cloud \
  -format json -output baseline.json

# The agent or a developer changes the code.

cce -folder . -language GO -filter cloud \
  -format json -output current.json

cce diff baseline.json current.json --fail-new
```

If the pull request (PR) adds a mapped `DeleteObject` call to a feature that previously only read and wrote artifacts, the new call site appears in the diff and `--fail-new` returns a failure. That does not mean the operation is bad. It means the security review now has a specific question:

> Why does this change need delete, on which objects, and should that permission ship with this role?

The same workflow catches less dramatic drift: a new Key Management Service (KMS) operation, a different messaging service, or an SDK call added outside the package the reviewer expected. CCE also has [GitHub Actions workflows](https://appcd-dev.github.io/cce/guides/github-actions/) for running the scan and diff in CI.

A clean diff is not a security proof. It only says CCE found no new mapped call sites relative to that baseline. IAM edits, unmapped wrappers, runtime behavior, and infrastructure changes still need their own controls.

## Example 3: give the reviewer artifacts, not a model's assurance

For a first pass on a checkout, CCE's quickstart creates both machine- and human-readable output:

```bash
cce quickstart .
```

It writes a Cloud API bill of materials (BOM), a self-contained Hypertext Markup Language (HTML) report, Static Analysis Results Interchange Format (SARIF) for code scanning, and a lens lock file with version and rule hashes. It also prepares a CI workflow without overwriting an existing one. If a supported IAM policy file is present, quickstart can add a static IAM-drift report for code-evidenced AWS operations missing from that policy.

This is a better review artifact than “I asked the agent, and it said these are the permissions.” The reviewer can inspect the call site, see which rules produced the row, reproduce the scan, and attach the result to the change.

The same structured output is useful beyond IAM. Custom lenses can inventory internal platform SDK usage, deprecated libraries, or selected vulnerability-related call sites. Those workflows need rules suited to the repository and, for non-cloud labels, `-filter all`. The [CCE use-case catalog](https://appcd-dev.github.io/cce/use-cases/catalog/) separates implemented scans from lens-dependent workflows and their proof status.

## What CCE will not tell you

A security tool earns trust by making its boundary clear:

| CCE does | CCE does not |
|---|---|
| Map visible source call sites to candidate operations | Execute the application or observe runtime-only calls |
| Show file, line, method, and enclosing function | Build an inter-procedural, cross-file call graph |
| Compare reports and flag new mapped call sites | Prove that an unchanged IAM policy is least privilege |
| Provide input for IAM review | Evaluate IAM policies, service control policies (SCPs), permission boundaries, or resource policies |
| Scan one selected language per run | Infer every call behind internal wrappers or dynamic dispatch |
| Parse application source | Parse Terraform, CloudFormation, Kubernetes manifests, or IAM JSON as part of the core scan |

The wrapper limitation deserves special attention. If application code calls `platform.Storage.Sync()` and the S3 calls live in another repository, scanning only the application will not reveal those underlying SDK calls. Scan the implementation, maintain a reviewed wrapper-to-action mapping, or add a custom lens for the visibility you need.

The full list is in CCE's [known limitations](https://appcd-dev.github.io/cce/reference/known-limitations/). The practical rule is simple: **use CCE to reduce guesswork, not to hide it.**

## A practical definition of done for agent-written cloud code

For teams using Cursor, Claude Code, Copilot, Gemini CLI, or an in-house agent, the tool that wrote the change matters less than the workflow around it:

1. **Constrain the agent.** Give its session the minimum repository, shell, and cloud access required. Keep high-impact tools behind approval or policy enforcement.
2. **Scan the result.** Generate CCE's cloud inventory for each relevant language and retain the report with the PR.
3. **Review the delta.** Treat new mapped operations—especially writes, deletes, key management, and identity operations—as explicit security questions.
4. **Narrow the deployed role.** Convert candidate operations into IAM actions, then scope resources and conditions in the actual infrastructure system. Test denied as well as allowed paths.
5. **Keep the boundary outside the model.** IAM, policy engines, sandboxing, and cloud APIs must enforce the decision even if the agent's instructions are misunderstood or manipulated.

None of this slows the agent down while it explores and writes code. It adds a deterministic security receipt at the point where generated code becomes production privilege.

## Let the agent write. Make the permissions prove themselves.

Coding agents are becoming a normal part of how software is written. That is exactly why “the agent wrote it” cannot become a shortcut around security review.

POLP has been with us for five decades because software and operators make mistakes. Agents add speed and autonomy; they do not change that equation. Broad credentials merely let those mistakes travel farther.

CCE gives the workflow a small, useful contract: **show me the cloud calls in this source, show me where they are, and show me what changed.** From there, engineers can do the part that should never be delegated to a plausible answer—decide what the system is allowed to do.

Install CCE and run the first scan locally:

```bash
brew tap stackgenhq/homebrew-stackgen
brew install stackgenhq/homebrew-stackgen/cce
cce quickstart .
```

Start with one service that already uses coding agents. Put the report in its next cloud-related PR. The goal is not to generate a bigger policy document. It is to make the next request for `:*` a little harder to justify.

---

*Related: [CCE cloud entitlements: CLI, CI, and custom lenses](/blog/cce-cloud-entitlements/) · [Why prompts fail as access control lists (ACLs)](/blog/authorize-ai-agent-tool-calls-opa/) · [Defense in depth for tool-wielding agents](/blog/defense-in-depth/).*
