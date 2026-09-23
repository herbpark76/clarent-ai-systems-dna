---
slug: how-tool-calling-works
title: How Tool Calling Works
category: Integration
readTime: 5 min read
description: A deep look at how LLMs invoke external functions — the mechanism behind every AI-powered integration.
concepts: [tool-calling, llms, apis, mcp, agents, guardrails]
updated: 2026-09-23
---

A language model on its own can only produce text. It can't look up an order, check inventory, run a calculation, or update a record. **Tool calling** (also called function calling) is the mechanism that lets it do those things — by asking your code to do them.

The key point to understand up front: **the model never runs anything itself.** It decides that a tool should be called and writes a structured request. Your application runs the tool and hands the result back. The model then uses that result to continue.

## The basic loop

Every tool-calling interaction follows the same cycle:

1. **You describe the available tools.** Along with the user's message, you send the model a list of tools: a name, a plain-language description, and a JSON Schema describing the inputs.
2. **The model decides.** Based on the question, the model either answers directly or responds with a *tool call*: the name of a tool and the arguments it wants to pass, as structured JSON.
3. **Your code executes.** Your application validates the arguments, calls the real function or API, and captures the result.
4. **You return the result.** The result goes back to the model as a new message in the conversation.
5. **The model continues.** It either answers the user using the result or calls another tool. The loop repeats until the model produces a final answer.

## What a tool definition looks like

A tool definition is a contract. Here is a simple one:

```json
{
  "name": "get_order_status",
  "description": "Look up the current status of a customer order by order number. Use this when the user asks where an order is or whether it has shipped.",
  "input_schema": {
    "type": "object",
    "properties": {
      "order_number": {
        "type": "string",
        "description": "The order number, e.g. SO-104233"
      }
    },
    "required": ["order_number"]
  }
}
```

When a user asks *"Has SO-104233 shipped yet?"*, the model responds with something like:

```json
{ "tool": "get_order_status", "arguments": { "order_number": "SO-104233" } }
```

Your code calls the order system, gets back `{"status": "shipped", "carrier": "UPS", "date": "2026-09-21"}`, and passes it to the model, which replies: *"Yes — it shipped via UPS on September 21."*

## The description is the interface

The model chooses tools based almost entirely on the **name and description**. It has no other way to know what a tool does. This makes descriptions the most important — and most neglected — part of tool design.

Good descriptions:

- Say **what the tool does** and **when to use it** (and when not to).
- Describe each parameter with its format and an example.
- Use the vocabulary your users use, not just internal system names.

A vague description like `"Gets data"` leads to the wrong tool being called, or the right tool being called with the wrong arguments.

## A worked example: tax determination

Consider an assistant that helps a finance team review invoices. It might have three tools:

- `get_invoice(invoice_id)` — returns line items, ship-to address, and product codes from the ERP.
- `calculate_tax(ship_to, line_items)` — calls the company's tax engine and returns tax by jurisdiction.
- `get_tax_code_mapping(product_code)` — returns the tax code configured for a product.

A user asks: *"Why was invoice 88412 charged county tax?"*

The model calls `get_invoice` to see the ship-to address and items, then `get_tax_code_mapping` for the relevant product, then `calculate_tax` to reproduce the result. With those three results in hand, it can explain that the ship-to address falls inside a county with its own local rate and that the product is mapped as taxable.

Notice what the model is doing and not doing. It isn't guessing at tax rules or rates. It's orchestrating calls to the **systems of record** and explaining what they return. That is the right division of labor: deterministic systems produce the numbers; the model navigates and explains.

## Tool calling vs. RAG

These are often confused because both bring outside information into the model.

- **RAG** retrieves passages of *text* from documents. Use it for knowledge: policies, manuals, research.
- **Tool calling** runs *functions* against live systems. Use it for data that must be exact and current, for calculations, and for taking actions.

"What is our policy on bundled service contracts?" is a RAG question. "What tax did we charge on invoice 88412?" is a tool-calling question. Many assistants use both.

## Where tool calling goes wrong

- **Too many tools.** Giving a model 80 tools makes selection unreliable. Group related operations, and expose only the tools relevant to the task.
- **Trusting the arguments.** The model's arguments are suggestions. Validate them like any user input — types, ranges, permissions — before executing.
- **Unsafe actions without confirmation.** Reading data is low risk. Creating, updating, deleting, or sending anything should require a confirmation step or tight permission limits.
- **Unhelpful errors.** If a tool fails, return a clear error message the model can act on ("order number not found — check the format SO-######") rather than a stack trace.
- **Huge results.** Returning an entire table floods the context window. Return what's needed, with summaries or pagination.

## How this connects to MCP and agents

Tool calling is the foundation for two bigger ideas:

- **MCP (Model Context Protocol)** standardizes how tools are described and served, so one tool integration can work across many AI applications instead of being rebuilt for each.
- **Agents** are what you get when you let the tool-calling loop run for multiple steps toward a goal, with the model planning which tools to call and in what order.

## Key takeaways

- The model requests tool calls; your code executes them and returns the results.
- Tool names and descriptions determine whether the right tool gets called.
- Use tools for exact, live data and actions; use RAG for document knowledge.
- Validate every argument, confirm risky actions, and keep results small.

**Where to go next on the map:** [MCP](/concepts/mcp) · [Agents](/concepts/agents) · [APIs](/concepts/apis) · [Guardrails](/concepts/guardrails)
