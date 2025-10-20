"use client";

import { useState } from "react";


export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const callOllamaAPI = async () => {
    setIsLoading(true);
    setResponse("");

    try {
      const apiResponse = await fetch("/api/ollama/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: inputValue }],
        }),
      });

      const data = await apiResponse.json();
      setResponse(data.content[0].text);
    } catch (error) {
      setResponse("Error: " + error.message);
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
          onClick={callOllamaAPI}
          disabled={isLoading || !inputValue}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
          style={{ marginTop: "20px" }}
        >
          {isLoading ? "Loading..." : "Ask Ollama"}
        </button>
      </div>

      {response && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <h3 className="font-bold mb-2">Ollama Response (gpt-oss:20b):</h3>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}
