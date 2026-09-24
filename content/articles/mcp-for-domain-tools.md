---
slug: mcp-for-domain-tools
title: MCP for Domain Tools
category: Domain
track: domain-builder
readTime: 4 min read
description: How to design MCP servers that give AI safe, useful access to the systems of record in a specialized field.
concepts: [mcp, tool-calling, apis, security, guardrails, agents]
updated: 2026-09-23
---

In a domain platform, the most important answers come from **systems of record**: the ERP, the calculation engine, the policy administration system, the document repository. The AI's job is to use those systems well — not to replace them. **MCP servers** are how you give AI that access in a standard, reusable, controllable way.

It's tempting to wrap an existing API and call it done. That usually produces a server that's hard for models to use and risky to operate. This article covers how to design domain tools well.

## Design tools around tasks, not endpoints

Enterprise APIs are built for developers: many small endpoints, internal IDs, and multi-step sequences. Models do better with fewer tools that each accomplish a meaningful task in the domain's own language.

| API-shaped (harder for AI) | Task-shaped (easier for AI) |
|---|---|
| `GET /materials/{id}`, `GET /materials/{id}/classifications`, `GET /taxcodes/{code}` | `get_product_tax_profile(product_number)` — returns the product, its tax code, and the code's description in one call |
| `POST /calc/request` with 40 fields | `calculate_tax(ship_to, line_items, invoice_date)` with sensible defaults |
| Search by internal UUID | Search by the identifiers users actually know: order numbers, product numbers, customer names |

Each tool should have a clear name, a description that says **when** to use it, and parameters described with formats and examples.

## Separate reading from changing

Split tools into clear groups:

- **Read tools** — look up, search, calculate, explain. Low risk; make these broadly available.
- **Proposal tools** — draft a change for a human to review ("propose a tax code change for product X"). Useful and safe.
- **Write tools** — actually change data. Expose these sparingly, to specific applications, with confirmation required.

Many domain platforms run entirely on read and proposal tools for their first year, and that's fine. A proposal that an expert approves in one click delivers most of the value with little of the risk.

## Let the system calculate

If the domain has a calculation engine — tax, pricing, rating, eligibility — expose it as a tool and instruct the AI to always use it. The model should never estimate a number that a system can compute. Its value is in choosing the right inputs, calling the calculation, and explaining the result in plain language.

## Return what the model needs

- **Keep results compact.** Return the relevant fields, not the full record. Large results crowd the context and hide what matters.
- **Include meaning, not just codes.** Return `"tax_code": "TC-4410", "tax_code_description": "Software maintenance – optional"` rather than the bare code.
- **Include provenance.** Which system, which record, as of when. It lets the AI cite its source.
- **Write useful errors.** "Product 88-1203 not found. Product numbers look like 88-1234." lets the model recover; a stack trace doesn't.

## Security for domain servers

Domain systems hold sensitive, business-critical data. Treat an MCP server like any other privileged integration:

- **Act as the user.** Authenticate the actual person (MCP supports OAuth) and enforce their existing permissions. Avoid a shared service account that can see everything.
- **Least privilege.** Each server exposes only what its use cases need.
- **Validate every input.** Tool arguments come from a model and should be treated like user input.
- **Log every call.** Who, what tool, what arguments, what result. In regulated domains this audit trail is essential.
- **Guard against injected instructions.** Data returned by tools — customer notes, emails, documents — can contain text aimed at manipulating the model. Keep consequential actions behind human confirmation.

## A worked example: a tax platform server

A tax team's MCP server might expose:

**Read**
- `get_invoice(invoice_number)` — lines, ship-to, customer, calculated tax by jurisdiction
- `get_product_tax_profile(product_number)` — tax code, description, mapping history
- `calculate_tax(ship_to, line_items, invoice_date)` — calls the tax engine
- `get_customer_exemptions(customer)` — certificates on file, jurisdictions, expiry dates

**Propose**
- `propose_tax_code_change(product_number, new_code, rationale)` — creates a review item for an analyst

No write tools at all. The research assistant, the exception-investigation agent, and the product-setup reviewer all connect to this one server, and all changes still go through an analyst.

## Key takeaways

- Design tools around domain tasks, in the domain's language, not around raw API endpoints.
- Separate read, propose, and write tools; start with read and propose.
- Let calculation engines calculate; the AI chooses inputs and explains results.
- Authenticate as the user, log everything, and keep consequential actions behind human approval.

**Where to go next:** [What is MCP?](/articles/what-is-mcp) · [How Tool Calling Works](/articles/how-tool-calling-works) · [Building a Domain Intelligence Platform](/articles/building-a-domain-intelligence-platform)
