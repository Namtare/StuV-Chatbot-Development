"use client";

import { useState } from "react";


export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [claudeResponse, setClaudeResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const callClaudeAPI = async () => {
    setIsLoading(true);
    setClaudeResponse("");

    try {
      const response = await fetch("/api/claude/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 1024,
          messages: [{ role: "user", content: inputValue }],
        }),
      });

      const data = await response.json();
      setClaudeResponse(data.content[0].text);
    } catch (error) {
      setClaudeResponse("Error: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex gap-4">
        <p
          style={{
            backgroundColor: "alice-blue",
            padding: "20px",
            width: "200px",
          }}
        >
          Text field
        </p>
        <div style={{ paddingTop: "20px" }}>
          <input
            name="myInput"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <button
          onClick={callClaudeAPI}
          disabled={isLoading || !inputValue}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
          style={{ marginTop: "20px" }}
        >
          {isLoading ? "Loading..." : "Ask Claude"}
        </button>
      </div>

      {claudeResponse && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h3 className="font-bold mb-2">Claude's Response:</h3>
          <p>{claudeResponse}</p>
        </div>
      )}
    </div>
  );
}
