import { useState } from "react";
import { SmartRewrite, type SmartRewriteDetail } from "react-smart-rewrite";
import { mockModel } from "./mockModel";

const SUBJECT = "re: you're order is delayed";
const MESSAGE = [
  "hey Ada,",
  "",
  "im really sorry but we is not able to ship you're order this week. thier was a problem at teh warehouse and alot of parcels are just stuck at this point in time. we definately dont want to keep you waiting!!",
  "",
  "you will recieve a new tracking link asap. we apologise for the inconvenince.",
  "",
  "thanks,",
  "Grace",
].join("\n");

export function App() {
  const [subject, setSubject] = useState(SUBJECT);
  const [message, setMessage] = useState(MESSAGE);
  const [log, setLog] = useState<SmartRewriteDetail[]>([]);

  return (
    <main>
      <h1>react-smart-rewrite</h1>
      <p className="lead">
        Select any text in the fields below, then press <strong>Rewrite</strong> (or ⌘J / Ctrl+J). Pick an action, check the change, and replace it.
      </p>

      <section className="panel">
        <h2>Reply to customer</h2>
        <SmartRewrite complete={mockModel} onRewrite={(detail) => setLog((entries) => [detail, ...entries].slice(0, 5))}>
          <form className="form" onSubmit={(event) => event.preventDefault()}>
            <label>
              Subject
              <input type="text" value={subject} onChange={(event) => setSubject(event.target.value)} />
            </label>
            <label>
              Message
              <textarea rows={11} value={message} onChange={(event) => setMessage(event.target.value)} />
            </label>
          </form>
        </SmartRewrite>
        <p className="note">
          This demo uses a mock model: plain find-and-replace that runs in the page, so no API key is needed and nothing is sent anywhere. Try
          “Fix spelling and grammar”, or type “make it a bullet list”.
        </p>
        <div className="row">
          <button
            type="button"
            onClick={() => {
              setSubject(SUBJECT);
              setMessage(MESSAGE);
              setLog([]);
            }}
          >
            Reset text
          </button>
        </div>
      </section>

      {log.length > 0 && (
        <section className="panel">
          <h2>What your app receives in onRewrite</h2>
          <pre>{JSON.stringify(log.map(({ field, ...rest }) => ({ ...rest, field: field.tagName.toLowerCase() })), null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
