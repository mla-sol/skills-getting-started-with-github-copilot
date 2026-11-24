const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { JSDOM } = require("jsdom");

async function main() {
  const mode = process.argv[2];
  assert.ok(["rendering", "styling"].includes(mode), "Choose rendering or styling");

  const dom = new JSDOM(readFileSync("src/static/index.html", "utf8"), {
    url: "http://activities.test/",
    runScripts: "outside-only",
  });
  const { window } = dom;
  const { document } = window;
  const activityName = "Test Sports & Arts";
  const originalEmail = "student+club@mergington.edu";
  const newEmail = "new+student@mergington.edu";
  const activity = {
    description: "Test activity",
    schedule: "Monday",
    max_participants: 10,
    participants: [originalEmail],
  };
  const errors = [];
  window.console.error = (...args) => errors.push(args.join(" "));
  window.addEventListener("error", (event) => errors.push(event.message));
  window.fetch = async (input, options = {}) => {
    const url = new URL(input, window.location.href);
    if (url.pathname === "/activities" && !options.method) {
      return { ok: true, json: async () => ({ [activityName]: structuredClone(activity) }) };
    }

    const email = url.searchParams.get("email");
    const prefix = `/activities/${encodeURIComponent(activityName)}`;
    if (url.pathname === `${prefix}/signup` && options.method === "POST") {
      assert.equal(email, newEmail);
      activity.participants.push(email);
    } else if (url.pathname === `${prefix}/unregister` && options.method === "DELETE") {
      assert.ok(activity.participants.includes(email));
      activity.participants.splice(activity.participants.indexOf(email), 1);
    } else {
      throw new Error(`Unexpected request: ${options.method || "GET"} ${url}`);
    }
    return { ok: true, json: async () => ({ message: "Registration updated" }) };
  };

  async function waitFor(predicate, message) {
    const deadline = Date.now() + 2000;
    while (!predicate()) {
      assert.deepEqual(errors, [], "Frontend reported an error");
      assert.ok(Date.now() < deadline, message);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  try {
    await new Promise((resolve) =>
      document.addEventListener("DOMContentLoaded", resolve, { once: true })
    );
    const style = document.createElement("style");
    style.textContent = readFileSync("src/static/styles.css", "utf8");
    document.head.appendChild(style);
    window.eval(readFileSync("src/static/app.js", "utf8"));
    document.dispatchEvent(new window.Event("DOMContentLoaded"));
    await waitFor(
      () => document.querySelector(".participants-list li"),
      "Activity cards did not render participants"
    );

    const card = () => document.querySelector(".activity-card");
    const participants = () => [...card().querySelectorAll(".participants-list li")];
    assert.ok(participants()[0].textContent.includes(originalEmail));

    if (mode === "styling") {
      const listStyle = window.getComputedStyle(card().querySelector(".participants-list"));
      assert.ok(
        listStyle.listStyle === "none" || listStyle.listStyleType === "none",
        "Participant lists must hide bullet points"
      );
      const button = participants()[0].querySelector("button");
      assert.ok(button, "Each participant needs an unregister button");
      assert.ok(button.querySelector("svg"), "The unregister button needs an icon");
      assert.ok(button.getAttribute("aria-label")?.includes(originalEmail));
      assert.equal(window.getComputedStyle(button).flexShrink, "0");
    } else {
      document.getElementById("email").value = newEmail;
      document.getElementById("activity").value = activityName;
      document.getElementById("signup-form").dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true })
      );
      await waitFor(
        () => participants().some((item) => item.textContent.includes(newEmail)),
        "Signup did not refresh the participant list"
      );
      assert.match(card().textContent, /8 spots left/);
      assert.equal(document.getElementById("activity").options.length, 2);

      for (const email of [newEmail, originalEmail]) {
        const participant = participants().find((item) => item.textContent.includes(email));
        participant.querySelector("button").click();
        await waitFor(
          () => !participants().some((item) => item.textContent.includes(email)),
          "Unregister did not refresh the participant list"
        );
      }
      assert.match(card().textContent, /10 spots left/);
      assert.ok(card().querySelector(".participants-empty"), "Show an empty-list message");
    }

    assert.deepEqual(errors, [], "Frontend reported an error");
    console.log(`Participant ${mode} checks passed`);
  } finally {
    window.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
