import { describe, it, expect } from "vitest";
import { formatRichText } from "../scripts/chat-renderer";

describe("formatRichText", () => {
  it("returns empty string for empty input", () => {
    expect(formatRichText("")).toBe("");
  });

  it("escapes dangerous HTML tags to prevent XSS", () => {
    const malicious = '<script>alert(1)</script> & "quotes"';
    const result = formatRichText(malicious);
    expect(result).toBe("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;quotes&quot;");
    expect(result).not.toContain("<script>");
  });

  it("formats closed bold **text** and unclosed streaming bold **partial", () => {
    const closed = "Hola **Kener**!";
    expect(formatRichText(closed)).toBe(
      'Hola <strong class="font-bold" style="color: inherit;">Kener</strong>!'
    );

    const streaming = "Hola **Kener**, soy **un texto en stream";
    expect(formatRichText(streaming)).toBe(
      'Hola <strong class="font-bold" style="color: inherit;">Kener</strong>, soy <strong class="font-bold" style="color: inherit;">un texto en stream</strong>'
    );
  });

  it("formats clickable URLs while keeping trailing punctuation outside the <a> tag", () => {
    const textWithUrls =
      "Únete a https://meet.google.com/abc-defg-hij, o visita (https://github.com/KennerGV).";
    const result = formatRichText(textWithUrls);

    expect(result).toContain(
      '<a href="https://meet.google.com/abc-defg-hij" target="_blank" rel="noopener noreferrer" class="chat-link">https://meet.google.com/abc-defg-hij</a>,'
    );
    expect(result).toContain(
      '(<a href="https://github.com/KennerGV" target="_blank" rel="noopener noreferrer" class="chat-link">https://github.com/KennerGV</a>).'
    );
  });

  it("formats bullet lists (* item and - item) and line breaks (\\n -> <br>)", () => {
    const listText = "Tecnologías:\n* .NET Core\n- Astro";
    const result = formatRichText(listText);
    expect(result).toBe("Tecnologías:<br>• .NET Core<br>• Astro");
  });
});
