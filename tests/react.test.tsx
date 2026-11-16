import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SmartRewrite, type SmartRewriteComplete, type SmartRewriteProps } from "../src";

afterEach(cleanup);

const TEXT = "Dear Ada, we is happy to tell you. Bye";

function Form(props: Omit<SmartRewriteProps, "children">) {
  const [value, setValue] = useState(TEXT);
  return (
    <SmartRewrite {...props}>
      <textarea aria-label="Message" value={value} onChange={(event) => setValue(event.target.value)} />
      <input aria-label="Secret" type="password" defaultValue="hunter2 hunter2" />
    </SmartRewrite>
  );
}

function select(label: string, start: number, end: number) {
  const field = screen.getByLabelText(label) as HTMLTextAreaElement;
  field.focus();
  field.setSelectionRange(start, end);
  fireEvent.select(field);
  return field;
}

const START = TEXT.indexOf("we is");
const END = TEXT.indexOf(" Bye");

describe("SmartRewrite", () => {
  it("rewrites the selection and replaces it after a preview", async () => {
    const complete = vi.fn<SmartRewriteComplete>(async () => '"We are happy to tell you."');
    const onRewrite = vi.fn();
    render(<Form complete={complete} onRewrite={onRewrite} contextSize={6} />);

    const field = select("Message", START, END);
    fireEvent.click(screen.getByRole("button", { name: "Rewrite" }));
    fireEvent.click(screen.getByRole("button", { name: "Fix spelling and grammar" }));

    const replace = await screen.findByRole("button", { name: "Replace" });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete.mock.calls[0]![0]).toMatchObject({
      text: "we is happy to tell you.",
      action: "grammar",
      before: " Ada, ",
      after: " Bye",
    });
    // Nothing changes until the user accepts.
    expect(field.value).toBe(TEXT);
    expect(document.querySelector(".rsr-preview del")?.textContent).toContain("we");
    expect(document.querySelector(".rsr-preview ins")?.textContent).toContain("We");

    fireEvent.click(replace);
    expect(field.value).toBe("Dear Ada, We are happy to tell you. Bye");
    expect(onRewrite).toHaveBeenCalledWith(
      expect.objectContaining({ original: "we is happy to tell you.", text: "We are happy to tell you.", action: "grammar" }),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("sends a typed instruction as a custom action", async () => {
    const complete = vi.fn<SmartRewriteComplete>(async () => ({ text: "nous sommes heureux." }));
    render(<Form complete={complete} />);

    select("Message", START, END);
    fireEvent.click(screen.getByRole("button", { name: "Rewrite" }));
    fireEvent.change(screen.getByPlaceholderText("Tell AI what to change…"), { target: { value: "Translate to French" } });
    fireEvent.submit(screen.getByPlaceholderText("Tell AI what to change…").closest("form")!);

    await screen.findByRole("button", { name: "Replace" });
    expect(complete.mock.calls[0]![0]).toMatchObject({ action: "custom", instruction: "Translate to French" });
  });

  it("shows an error and can try again", async () => {
    let calls = 0;
    const complete: SmartRewriteComplete = async () => {
      calls++;
      if (calls === 1) return new Response("down", { status: 503 });
      return "We are happy.";
    };
    const onError = vi.fn();
    render(<Form complete={complete} onError={onError} />);

    const field = select("Message", START, END);
    fireEvent.click(screen.getByRole("button", { name: "Rewrite" }));
    fireEvent.click(screen.getByRole("button", { name: "Make shorter" }));

    expect((await screen.findByRole("alert")).textContent).toContain("503");
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "request" }));
    expect(field.value).toBe(TEXT);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("button", { name: "Replace" });
    expect(calls).toBe(2);
  });

  it("refuses to replace text that changed in the meantime", async () => {
    render(<Form complete={async () => "We are happy."} />);

    const field = select("Message", START, END);
    fireEvent.click(screen.getByRole("button", { name: "Rewrite" }));
    fireEvent.click(screen.getByRole("button", { name: "Improve writing" }));
    const replace = await screen.findByRole("button", { name: "Replace" });

    fireEvent.change(field, { target: { value: "Something else entirely" } });
    fireEvent.click(replace);
    expect(screen.getByRole("alert").textContent).toContain("changed");
    expect(field.value).toBe("Something else entirely");
  });

  it("stops a request and ignores its late answer", async () => {
    let finish: (text: string) => void = () => {};
    let signal: AbortSignal | undefined;
    const complete: SmartRewriteComplete = (request) => {
      signal = request.signal;
      return new Promise<string>((resolve) => (finish = resolve));
    };
    render(<Form complete={complete} />);

    const field = select("Message", START, END);
    fireEvent.click(screen.getByRole("button", { name: "Rewrite" }));
    fireEvent.click(screen.getByRole("button", { name: "Make shorter" }));
    fireEvent.click(await screen.findByRole("button", { name: "Stop" }));

    expect(signal?.aborted).toBe(true);
    await act(async () => finish("late"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(field.value).toBe(TEXT);
  });

  it("opens from the keyboard shortcut and closes with Escape", async () => {
    render(<Form complete={async () => "x"} shortcut="ctrl+j" />);

    const field = select("Message", START, END);
    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Rewrite" })).toBeNull();

    field.setSelectionRange(START, END);
    fireEvent.keyDown(field, { key: "j", ctrlKey: true });
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Improve writing"));

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([START, END]);
  });

  it("stays away without a selection, in password fields and when disabled", () => {
    const { rerender } = render(<Form complete={async () => "x"} />);

    select("Message", 3, 3);
    expect(screen.queryByRole("button", { name: "Rewrite" })).toBeNull();
    select("Secret", 0, 7);
    expect(screen.queryByRole("button", { name: "Rewrite" })).toBeNull();

    select("Message", START, END);
    expect(screen.getByRole("button", { name: "Rewrite" })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("button", { name: "Rewrite" })).toBeNull();

    rerender(<Form complete={async () => "x"} disabled />);
    select("Message", START, END);
    expect(screen.queryByRole("button", { name: "Rewrite" })).toBeNull();
  });

  it("rejects a selection over the limit without calling the model", async () => {
    const complete = vi.fn<SmartRewriteComplete>(async () => "x");
    render(<Form complete={complete} maxLength={10} actions={[{ id: "a", label: "Only action", instruction: "Do it." }]} allowCustom={false} />);

    select("Message", START, END);
    fireEvent.click(screen.getByRole("button", { name: "Rewrite" }));
    expect(screen.queryByPlaceholderText("Tell AI what to change…")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Only action" }));

    expect((await screen.findByRole("alert")).textContent).toContain("limit is 10");
    expect(complete).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
