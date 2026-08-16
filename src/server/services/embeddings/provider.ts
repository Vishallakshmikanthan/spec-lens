/**
 * EmbeddingProvider implementation for SpecLens.
 *
 * Server-side only - never import into browser components.
 * Supports multiple embedding model backends via configuration.
 *
 * Available backends:
 * 1. "local" - Uses a local Hugging Face inference or model
 * 2. "nemotron" - NVIDIA Nemotron API (server-side key only)
 * 3. "openai" - OpenAI embeddings API (server-side key only)
 * 4. "hf" - Hugging Face Inference API (server-side key only)
 * 5. "mock" - Deterministic mock for development/testing
 *
 * The provider is selected via EMBEDDING_PROVIDER env var.
 * Model dimension must match the pgvector column dimension.
 */
import { EmbeddingProvider, EmbeddingConfig } from "@/lib/embedding/provider";

/**
 * Get the configured embedding provider.
 * Throws if no provider is configured and no fallback is available.
 */
export function getEmbeddingProvider(): EmbeddingProvider {
  const providerName = process.env.EMBEDDING_PROVIDER || "mock";
  const dimension = Number(process.env.DIMENSION) || 384;

  switch (providerName.toLowerCase()) {
    case "nemotron":
      return new NemotronEmbeddingProvider(dimension);

    case "openai":
      return new OpenAIEmbeddingProvider(dimension);

    case "hf":
      return new HuggingFaceEmbeddingProvider(dimension);

    case "mock":
    default:
      return new MockEmbeddingProvider(dimension);
  }
}

/**
 * MockEmbeddingProvider - Deterministic mock for development and testing.
 * Generates consistent embeddings based on text content hash.
 * Dimension matches the configured DIMENSION (default 384).
 * 
 * NOT for production use - only for development, demos, and testing.
 */
class MockEmbeddingProvider {
  private dimension: number;

  constructor(dimension: number) {
    this.dimension = dimension;
  }

  /**
   * Generate a deterministic embedding vector from text.
   * The same text always produces the same vector.
   * Uses SHA-256 hash of the text to generate vector components.
   */
  async embedText(text: string): Promise<number[]> {
    if (!text || text.length === 0) {
      return new Array(this.dimension).fill(0);
    }

    // Import crypto server-side only
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update(text).digest();

    // Convert hash to floating point vector in [0, 1]
    const floatArray: number[] = [];
    for (let i = 0; i < this.dimension; i++) {
      // Use 4 bytes of the hash per vector component
      const byteOffset = (i * 4) % hash.length;
      const hashVal = hash.readUInt32BE(byteOffset) / 0xffffffff;
      floatArray.push(hashVal - 0.5); // Shift to [-0.5, 0.5]
    }

    // Normalize to approximate unit length
    let sum = 0;
    for (const v of floatArray) sum += v * v;
    const norm = Math.sqrt(sum) || 1;
    return floatArray.map((v) => v / norm);
  }

  /**
   * Embed multiple texts. Calls embedText for each.
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embedText(t)));
  }
}

/**
 * NemotronEmbeddingProvider - NVIDIA Nemotron API provider.
 * Server-side only - reads API key from process.env.NEMOTRON_API_KEY.
 * Never exposed to the browser.
 */
class NemotronEmbeddingProvider {
  private dimension: number;
  private apiKey: string | undefined;
  private baseUrl: string;

  constructor(dimension: number) {
    this.dimension = dimension;
    this.apiKey = process.env.NEMOTRON_API_KEY;
    this.baseUrl = process.env.NEMOTRON_BASE_URL || "https://api.nvidia.com/v1";
  }

  /**
   * Embed a single text using the Nemotron API.
   * Throws if no API key is configured.
   */
  async embedText(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error(
        "NEMOTRON_API_KEY environment variable is not configured. " +
          "Set it in your .env file or environment for Nemotron embeddings."
      );
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.NEMOTRON_MODEL || "nvidia/nemotron",
        input: text,
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Nemotron API error ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();
    if (!data.data || data.data.length === 0) {
      throw new Error("Nemotron API returned no embedding data");
    }

    return data.data[0].embedding;
  }

  /**
   * Embed multiple texts in one request if the provider supports batching.
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    if (!this.apiKey) {
      throw new Error(
        "NEMOTRON_API_KEY environment variable is not configured."
      );
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.NEMOTRON_MODEL || "nvidia/nemotron",
        input: texts,
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Nemotron API error ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();
    if (!data.data || data.data.length === 0) {
      throw new Error("Nemotron API returned no embedding data");
    }

    return data.data.map((item: any) => item.embedding);
  }
}

/**
 * OpenAIEmbeddingProvider - OpenAI embeddings API provider.
 * Server-side only - reads API key from process.env.OPENAI_API_KEY.
 * Never exposed to the browser.
 */
class OpenAIEmbeddingProvider {
  private dimension: number;
  private apiKey: string | undefined;
  private baseUrl: string;

  constructor(dimension: number) {
    this.dimension = dimension;
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  }

  async embedText(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error(
        "OPENAI_API_KEY environment variable is not configured."
      );
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
        input: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (!data.data || data.data.length === 0) {
      throw new Error("OpenAI API returned no embedding data");
    }

    return data.data[0].embedding;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not configured.");
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
        input: texts,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (!data.data || data.data.length === 0) {
      throw new Error("OpenAI API returned no embedding data");
    }

    return data.data.map((item: any) => item.embedding);
  }
}

/**
 * HuggingFaceEmbeddingProvider - Hugging Face Inference API provider.
 * Server-side only - reads API key from process.env.HF_API_KEY.
 * Never exposed to the browser.
 */
class HuggingFaceEmbeddingProvider {
  private dimension: number;
  private apiKey: string | undefined;
  private baseUrl: string;

  constructor(dimension: number) {
    this.dimension = dimension;
    this.apiKey = process.env.HF_API_KEY;
    this.baseUrl = process.env.HF_BASE_URL || "https://api-inference.huggingface.co/models";
  }

  async embedText(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error(
        "HF_API_KEY environment variable is not configured."
      );
    }

    // Use all-MiniLM-L6-v2 which has 384-dimensional output
    const modelId = process.env.HF_MODEL_ID || "sentence-transformers/all-MiniLM-L6-v2";
    const url = `${this.baseUrl}/${modelId}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ inputs: text }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Hugging Face API returned no embedding data");
    }

    // Ensure correct dimension
    if (data.length !== this.dimension) {
      // Truncate or pad as needed
      return data.slice(0, this.dimension).concat(
        new Array(Math.max(0, this.dimension - data.length)).fill(0)
      );
    }

    return data;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    if (!this.apiKey) {
      throw new Error("HF_API_KEY environment variable is not configured.");
    }

    const modelId = process.env.HF_MODEL_ID || "sentence-transformers/all-MiniLM-L6-v2";
    const url = `${this.baseUrl}/${modelId}`;

    // HF inference API typically processes one request at a time
    // For batch, we send all inputs in one call if supported
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ inputs: texts }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [data].map((item: any) => item);
    }

    // Ensure correct dimension for each result
    return data.map((item: any) => {
      if (Array.isArray(item) && item.length === this.dimension) {
        return item;
      }
      // Fallback: pad/truncate
      return item.slice(0, this.dimension).concat(
        new Array(Math.max(0, this.dimension - item.length)).fill(0)
      );
    });
  }
}