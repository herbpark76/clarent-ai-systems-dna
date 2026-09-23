---
slug: what-is-mcp
title: What is MCP?
category: Protocols
readTime: 4 min read
description: Model Context Protocol explained — the emerging standard that lets AI agents connect to any tool or data source.
concepts: [mcp, tool-calling, agents, apis, security]
updated: 2026-09-23
---

Tool calling lets a model use your systems. But without a standard, every AI application needs its own custom integration for every system: one connector for the chat assistant, another for the coding tool, another for the internal agent. Ten applications and twenty systems means up to two hundred integrations to build and maintain.

The **Model Context Protocol (MCP)** is an open standard that solves this. You build an integration once, as an **MCP server**, and any AI application that speaks MCP can use it. Anthropic introduced MCP in late 2024, and it has since been adopted across the major AI assistants, coding tools, and agent frameworks.

The common analogy is USB-C: one standard connector instead of a different cable for every device.

## The pieces

MCP has three roles:

- **Host** — the AI application the user interacts with, such as a chat assistant, an IDE, or a custom agent.
- **Client** — the component inside the host that maintains a connection to one MCP server.
- **Server** — a program that exposes capabilities from some system: a database, a file store, a SaaS product, an ERP.

A host can connect to many servers at once. A single assistant might use a server for your document store, one for your ticketing system, and one for your data warehouse.

## What a server can offer

An MCP server exposes three kinds of things:

- **Tools** — functions the model can call, like `search_invoices` or `create_ticket`. This is tool calling, standardized.
- **Resources** — data the application can read and put into context, like a file, a record, or a schema.
- **Prompts** — reusable templates or workflows the server offers, such as "summarize this account" or "review this contract."

Most real-world servers today are mostly about tools.

## How it works

Under the hood, MCP is a structured message exchange (JSON-RPC) between client and server:

1. **Connect and negotiate.** The client connects and the two sides agree on protocol version and capabilities.
2. **Discover.** The client asks the server what tools, resources, and prompts it offers, and the server returns names, descriptions, and input schemas.
3. **Use.** When the model decides to call a tool, the host sends the call through the client to the server, which runs it and returns the result.

Servers can run **locally** on the user's machine (communicating over standard input/output) or **remotely** as web services (over HTTP), which is how most enterprise and SaaS servers are offered.

## A worked example: an ERP tax server

Imagine a company runs its tax determination through a tax engine integrated with its ERP. The finance team uses a chat assistant, the IT team uses an AI coding tool, and the company is piloting an agent that reviews invoices overnight.

Without MCP, each of those three needs its own integration to the tax engine and ERP. With MCP, the company builds one server exposing tools like:

- `lookup_tax_code(product_code)`
- `calculate_tax(ship_to, line_items)`
- `get_exemption_certificate(customer_id)`

All three AI applications connect to the same server. Access rules, logging, and fixes live in one place. When a new tool is added, every application gets it.

## Why it matters

- **Build once, use everywhere.** Integrations become reusable assets instead of one-off code.
- **Swap models and apps freely.** Because the protocol is standard, you aren't locked into one vendor's plugin format.
- **An ecosystem.** Many software vendors now publish official MCP servers for their products, so you often don't need to build the integration at all.
- **Central control.** One server is one place to enforce permissions and audit usage.

## What to watch out for

MCP makes it easy to give an AI access to real systems — which is exactly why it needs care.

- **Least privilege.** Expose only the operations needed. A read-only server is much safer than one that can write.
- **Authentication.** Remote servers should use proper authorization (MCP supports OAuth), and actions should run with the permissions of the actual user, not a shared super-account.
- **Untrusted servers.** A third-party server's tool descriptions and results go straight into the model's context. A malicious or compromised server can try to manipulate the model. Only connect servers you trust.
- **Prompt injection through data.** Content returned by tools — emails, documents, web pages — can contain instructions aimed at the model. Treat it as data, and require confirmation for consequential actions.

## Key takeaways

- MCP is an open standard for connecting AI applications to tools and data.
- Servers expose tools, resources, and prompts; hosts connect to many servers at once.
- The payoff is reuse: one integration serves every MCP-compatible application.
- Treat MCP servers as privileged access to your systems and secure them accordingly.

**Where to go next on the map:** [Tool Calling](/concepts/tool-calling) · [Agents](/concepts/agents) · [Security](/concepts/security)
