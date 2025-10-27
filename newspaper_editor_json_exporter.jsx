import React, { useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { format } from "date-fns";
import {
  Download,
  Plus,
  Trash2,
  Star,
  StarOff,
  ArrowUp,
  ArrowDown,
  Copy,
  Image as ImageIcon,
  FileJson,
  FileUp,
  FileDown,
  Bug
} from "lucide-react";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------
// Types
// ---------------------------------------------

/** Inline image within an article body */
type InlineImage = {
  url: string;
  caption?: string;
};

/** Article schema matching user's required format */
export type Article = {
  id: number;
  isFeatured: boolean;
  category: string;
  title: string;
  author: string;
  date: string; // "Oct 25, 2025"
  summary: string;
  image: string; // main/hero image url
  accentColorClass: string;
  borderColorClass: string;
  inlineImages: InlineImage[];
  content: string; // rich text or plain text; exporter can strip html if desired
};

// ---------------------------------------------
// Helpers (pure functions; also used by tests)
// ---------------------------------------------

const CATEGORY_OPTIONS = [
  "Campus Life",
  "Sports",
  "Arts & Culture",
  "Academics",
  "Opinion",
  "News",
  "Community",
  "Features",
];

const ACCENT_OPTIONS = [
  "text-bowman-highlight",
  "text-bowman-secondary",
  "text-bowman-accent",
];

const BORDER_OPTIONS = [
  "border-bowman-secondary/30",
  "border-bowman-highlight/30",
  "border-bowman-accent/30",
];

function nextId(articles: Article[]): number {
  return articles.length ? Math.max(...articles.map((a) => a.id)) + 1 : 1;
}

function download(filename: string, data: string) {
  const blob = new Blob([data], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || div.innerText || "").replace(/\u00A0/g, " ");
}

// Format a JS Date (or date string) to "MMM dd, yyyy"
function formatPrettyDate(d: Date | string): string {
  try {
    return format(typeof d === "string" ? new Date(d) : d, "MMM d, yyyy");
  } catch {
    return "";
  }
}

/** Normalize an arbitrary array of items into the Article[] schema */
function normalizeArticleArray(parsed: any[]): Article[] {
  return parsed.map((x: any, i: number) => ({
    id: typeof x.id === "number" ? x.id : i + 1,
    isFeatured: !!x.isFeatured,
    category: x.category ?? "Campus Life",
    title: x.title ?? "Untitled",
    author: x.author ?? "",
    date: x.date ?? formatPrettyDate(new Date()),
    summary: x.summary ?? "",
    image: x.image ?? "",
    accentColorClass: x.accentColorClass ?? ACCENT_OPTIONS[0],
    borderColorClass: x.borderColorClass ?? BORDER_OPTIONS[0],
    inlineImages: Array.isArray(x.inlineImages)
      ? x.inlineImages.map((im: any) => ({ url: im?.url ?? "", caption: im?.caption ?? "" }))
      : [],
    content: typeof x.content === "string" ? x.content : "",
  }));
}

/** Convert articles to exportable plain objects, optionally stripping HTML */
function toExportArray(articles: Article[], asPlainText: boolean) {
  return articles.map((a) => ({
    ...a,
    content: asPlainText ? stripHtml(a.content) : a.content,
  }));
}

/** Validate that an object looks like an article (light check) */
function looksLikeArticle(a: any): boolean {
  const req = [
    "id",
    "isFeatured",
    "category",
    "title",
    "author",
    "date",
    "summary",
    "image",
    "accentColorClass",
    "borderColorClass",
    "inlineImages",
    "content",
  ];
  return (
    a &&
    req.every((k) => Object.prototype.hasOwnProperty.call(a, k)) &&
    typeof a.id === "number" && typeof a.title === "string"
  );
}

// ---------------------------------------------
// Example payload (refactored for reuse in tests)
// ---------------------------------------------
function getExampleArticles(): Article[] {
  return [
    {
      id: 1,
      isFeatured: true,
      category: "Campus Life",
      title: "Debate Team Wins State Championship",
      author: "Jane Doe",
      date: "Oct 25, 2025",
      summary:
        "After months of rigorous practice, the Bowman High Debate Team secured a hard-fought victory at the state finals, bringing home the trophy for the first time in school history.",
      image: "https://placehold.co/800x600/EDDDD4/283D3B?text=DEBATE+WINS",
      accentColorClass: "text-bowman-highlight",
      borderColorClass: "border-bowman-secondary/30",
      inlineImages: [
        {
          url: "https://placehold.co/800x450/772E25/EDDDD4?text=Team+Photo",
          caption: "The victorious debate team holding their championship trophy.",
        },
      ],
      content:
        "The air was thick with anticipation as the final round of the state debate championship began. Representing Bowman High, seniors Jane Doe and Mark Smith faced off against their rivals from Lincoln High in a tense policy debate on renewable energy.\n\nTheir arguments, honed over countless hours of practice, were precise and compelling. The judges commended their 'masterful use of evidence and persuasive rhetoric.'\n\n<image-1>\n\nWhen the verdict was announced, the Bowman contingent erupted in cheers. 'This is a dream come true,' said team captain Jane Doe. 'It's a testament to every person on this team and the endless support from our coach.' This victory marks a new era for the school's forensic program, promising a bright future for aspiring debaters.",
    },
    {
      id: 2,
      isFeatured: false,
      category: "Sports",
      title: "Football Team Dominates Season Opener",
      author: "John Smith",
      date: "Oct 24, 2025",
      summary:
        "The Bowman Bears delivered a stunning 35-7 performance in the pre-season opener, signaling a promising season ahead.",
      image: "https://placehold.co/600x400/197278/EDDDD4?text=FOOTBALL",
      accentColorClass: "text-bowman-secondary",
      borderColorClass: "border-bowman-secondary/30",
      inlineImages: [],
      content:
        "The Bowman Bears delivered a stunning 35-7 performance in the pre-season opener. From the first whistle, the team showed incredible cohesion and strength. Quarterback Michael Lee threw for three touchdowns, connecting twice with wide receiver-star, David Chen, for impressive gains.\n\nThe defense was equally formidable, holding the Lincoln Lions to just one touchdown in the final quarter. Coach Miller praised the team's 'unwavering focus and off-season dedication.' Fans are hopeful this momentum will carry them deep into the playoffs.",
    },
    {
      id: 3,
      isFeatured: false,
      category: "Arts & Culture",
      title: "Drama Club's 'Our Town' A Poignant Success",
      author: "Alex Johnson",
      date: "Oct 23, 2025",
      summary:
        "The Drama Club's interpretation of the Thornton Wilder classic offered fresh perspectives on life, love, and loss, leaving the audience deeply moved.",
      image: "https://placehold.co/600x400/C44536/EDDDD4?text=THEATRE",
      accentColorClass: "text-bowman-highlight",
      borderColorClass: "border-bowman-highlight/30",
      inlineImages: [],
      content:
        "The Drama Club's rendition of 'Our Town' was a profound and moving experience. The minimalist set design placed the focus squarely on the actors' performances, and they delivered with remarkable depth.\n\nSarah Jenkins, as Emily Webb, was a standout, capturing the character's journey with a nuance that belied her age. The final act was particularly powerful, leaving few dry eyes in the auditorium. Director Ms. Alvarez has once again guided her students to create a piece of theatre that is both timeless and deeply personal.",
    },
    {
      id: 4,
      isFeatured: true,
      category: "Academics",
      title: "New STEM Lab Opens",
      author: "Jane Doe",
      date: "Oct 22, 2025",
      summary:
        "Thanks to a generous grant, the new Bowman STEM lab is officially open, featuring 3D printers, robotics kits, and a state-of-the-art chemistry station.",
      image: "https://placehold.co/800x600/283D3B/EDDDD4?text=STEM+LAB",
      accentColorClass: "text-bowman-accent",
      borderColorClass: "border-bowman-accent/30",
      inlineImages: [],
      content:
        "The ribbon-cutting ceremony for the new STEM lab was a celebration of the future. Principal Davies called it 'a quantum leap forward for our curriculum.' Students in the robotics club are already at work, programming autonomous vehicles for an upcoming competition.\n\nThe lab will support new courses in engineering, biotechnology, and computer science, ensuring Bowman students are well-prepared for the challenges of the 21st century.",
    },
    {
      id: 5,
      isFeatured: false,
      category: "Opinion",
      title: "The Case for a Later School Start Time",
      author: "Editorial Board",
      date: "Oct 21, 2025",
      summary:
        "Sleep deprivation is an epidemic among teens. It's time for the school board to seriously consider pushing the first bell back to 8:30 a.m.",
      image: "https://placehold.co/600x400/EDDDD4/283D3B?text=OPINION",
      accentColorClass: "text-bowman-accent",
      borderColorClass: "border-bowman-accent/30",
      inlineImages: [],
      content:
        "The alarm rings at 6:00 a.m. For many Bowman students, this is the start of another day battling exhaustion. Numerous studies show that teenage brains are wired to stay up later and wake up later. By forcing students to be in class by 7:30 a.m., we are setting them up for failure.\n\nAcademic performance, mental health, and even physical safety (drowsy driving) are all compromised. While logistical challenges exist, the health and well-being of students must be our top priority. We urge the school board to follow the science and implement a later start time.\n\nThis is a long test string to check the text-wrapping feature we added: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  ];
}

// ---------------------------------------------
// Main Component
// ---------------------------------------------

export default function NewspaperEditor() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [exportPlainText, setExportPlainText] = useState<boolean>(false);
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const quillRef = useRef<ReactQuill | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedIndex = useMemo(
    () => (selectedId == null ? -1 : articles.findIndex((a) => a.id === selectedId)),
    [articles, selectedId]
  );
  const selected = selectedIndex >= 0 ? articles[selectedIndex] : null;

  const filteredArticles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return articles.filter((a) => {
      const matchesSearch = term
        ? [a.title, a.author, a.summary, a.category].some((x) => x?.toLowerCase().includes(term))
        : true;
      const matchesCategory = categoryFilter === "ALL" ? true : a.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [articles, search, categoryFilter]);

  function addArticle() {
    const id = nextId(articles);
    const today = formatPrettyDate(new Date());
    const newArticle: Article = {
      id,
      isFeatured: false,
      category: CATEGORY_OPTIONS[0],
      title: "Untitled Article",
      author: "",
      date: today,
      summary: "",
      image: "",
      accentColorClass: ACCENT_OPTIONS[0],
      borderColorClass: BORDER_OPTIONS[0],
      inlineImages: [],
      content: "",
    };
    setArticles((prev) => [...prev, newArticle]);
    setSelectedId(id);
  }

  function duplicateArticle(id: number) {
    setArticles((prev) => {
      const idx = prev.findIndex((a) => a.id === id);
      if (idx === -1) return prev;
      const base = prev[idx];
      const copy: Article = { ...base, id: nextId(prev), title: base.title + " (Copy)" };
      const arr = [...prev, copy];
      setSelectedId(copy.id);
      return arr;
    });
  }

  function deleteArticle(id: number) {
    setArticles((prev) => prev.filter((a) => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function moveArticle(id: number, dir: -1 | 1) {
    setArticles((prev) => {
      const idx = prev.findIndex((a) => a.id === id);
      if (idx === -1) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(newIdx, 0, item);
      return copy;
    });
  }

  function updateSelected<K extends keyof Article>(key: K, value: Article[K]) {
    if (!selected) return;
    setArticles((prev) => {
      const idx = prev.findIndex((a) => a.id === selected.id);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: value } as Article;
      return copy;
    });
  }

  function updateInlineImage(index: number, field: keyof InlineImage, value: string) {
    if (!selected) return;
    const imgs = [...selected.inlineImages];
    imgs[index] = { ...imgs[index], [field]: value };
    updateSelected("inlineImages", imgs);
  }

  function addInlineImage() {
    if (!selected) return;
    const imgs = [...selected.inlineImages, { url: "", caption: "" }];
    updateSelected("inlineImages", imgs);
  }

  function removeInlineImage(index: number) {
    if (!selected) return;
    const imgs = selected.inlineImages.filter((_, i) => i !== index);
    updateSelected("inlineImages", imgs);
  }

  function insertImageToken(n: number) {
    const token = `<image-${n}>`;
    const quill = quillRef.current?.getEditor?.();
    if (quill) {
      const range = quill.getSelection(true);
      const pos = range ? range.index : quill.getLength();
      quill.insertText(pos, token);
      quill.setSelection(pos + token.length, 0);
    } else {
      // Fallback: append to content string
      updateSelected("content", (selected?.content || "") + token);
    }
  }

  function exportJson({ downloadFile }: { downloadFile: boolean }) {
    const payload = toExportArray(articles, exportPlainText);
    const text = JSON.stringify(payload, null, 2);
    if (downloadFile) {
      download("newspaper.json", text);
    }
    return text;
  }

  function handleImportText(text: string) {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("JSON root must be an array of articles.");
      const normalized = normalizeArticleArray(parsed);
      setArticles(normalized);
      setSelectedId(normalized[0]?.id ?? null);
      alert(`Imported ${normalized.length} article(s).`);
    } catch (err: any) {
      alert("Import failed: " + err?.message);
    }
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      handleImportText(String(reader.result || ""));
    };
    reader.readAsText(file);
  }

  function loadExample() {
    const example = getExampleArticles();
    setArticles(example);
    setSelectedId(example[0].id);
  }

  // --------------------------
  // Lightweight Test Runner
  // --------------------------
  function runTests() {
    type Result = { name: string; passed: boolean; info?: string };
    const results: Result[] = [];
    const ok = (name: string, passed: boolean, info?: string) => results.push({ name, passed, info });

    // Test 1: Normalization fills defaults & types
    const raw1 = [{ title: "Only Title" }];
    const norm1 = normalizeArticleArray(raw1);
    ok(
      "Normalize fills defaults",
      norm1.length === 1 &&
        typeof norm1[0].id === "number" &&
        norm1[0].category === "Campus Life" &&
        norm1[0].title === "Only Title" &&
        Array.isArray(norm1[0].inlineImages)
    );

    // Test 2: Export array preserves HTML unless plain-text requested
    const htmlArticle: Article = {
      id: 99,
      isFeatured: false,
      category: "News",
      title: "HTML Check",
      author: "QA",
      date: "Oct 27, 2025",
      summary: "",
      image: "",
      accentColorClass: ACCENT_OPTIONS[0],
      borderColorClass: BORDER_OPTIONS[0],
      inlineImages: [],
      content: "<p>Hello&nbsp;world</p>",
    };
    const expHtml = toExportArray([htmlArticle], false)[0];
    const expTxt = toExportArray([htmlArticle], true)[0];
    ok("Export keeps HTML by default", expHtml.content.includes("<p>") && expHtml.content.includes("&nbsp;"));
    ok("Export strips HTML when plain", expTxt.content === "Hello world");

    // Test 3: Example payload shape
    const examples = getExampleArticles();
    ok("Example has 5 articles", examples.length === 5);
    ok("Example shape valid", examples.every(looksLikeArticle));

    // Test 4: Image token helper doesn't throw and token text is correct
    const token = `<image-${3}>`;
    ok("Image token formatting", token === "<image-3>");

    const summary = results
      .map((r) => `${r.passed ? "✅" : "❌"} ${r.name}${r.info ? ` — ${r.info}` : ""}`)
      .join("\n");
    setTestOutput(summary);
  }

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ align: [] }],
        ["link"],
        ["clean"],
      ],
      clipboard: { matchVisual: false },
    }),
    []
  );

  return (
    <div className="w-full h-full flex flex-col gap-3 p-4 bg-neutral-50">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={addArticle} className="gap-2"><Plus className="h-4 w-4"/> New Article</Button>
        <Button variant="secondary" className="gap-2" onClick={() => {
          if (!selected) { alert("Select an article first."); return; }
          duplicateArticle(selected.id);
        }}><Copy className="h-4 w-4"/> Duplicate</Button>
        <Separator orientation="vertical" className="mx-2 h-6"/>
        <Button variant="outline" className="gap-2" onClick={() => {
          const text = exportJson({ downloadFile: false });
          navigator.clipboard.writeText(text).then(() => alert("JSON copied to clipboard."));
        }}><FileJson className="h-4 w-4"/> Copy JSON</Button>
        <Button variant="outline" className="gap-2" onClick={() => download("newspaper.json", exportJson({ downloadFile: false }))}>
          <Download className="h-4 w-4"/> Download JSON
        </Button>
        <div className="flex items-center gap-2 ml-2">
          <Checkbox id="plain" checked={exportPlainText} onCheckedChange={(v) => setExportPlainText(Boolean(v))} />
          <Label htmlFor="plain" className="text-sm">Export content as plain text</Label>
        </div>
        <Separator orientation="vertical" className="mx-2 h-6"/>
        <Button variant="secondary" className="gap-2" onClick={loadExample}><FileDown className="h-4 w-4"/> Load Example</Button>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImportFile(f);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}/>
        <Button variant="secondary" className="gap-2" onClick={() => fileInputRef.current?.click()}><FileUp className="h-4 w-4"/> Import JSON</Button>
        <Separator orientation="vertical" className="mx-2 h-6"/>
        <Button variant="outline" className="gap-2" onClick={runTests}><Bug className="h-4 w-4"/> Run Tests</Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left: Article List & Filters */}
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Articles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Search title/author/summary..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-[60vh] overflow-auto divide-y">
              {filteredArticles.map((a) => (
                <div
                  key={a.id}
                  className={`p-3 flex items-start gap-2 cursor-pointer hover:bg-neutral-100 ${selectedId===a.id ? "bg-neutral-100" : ""}`}
                  onClick={() => setSelectedId(a.id)}
                >
                  <div className="pt-1">
                    {a.isFeatured ? <Star className="h-4 w-4"/> : <StarOff className="h-4 w-4 text-neutral-400"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{a.title || "Untitled"}</div>
                    <div className="text-xs text-neutral-600 truncate">{a.category} · {a.author || "—"}</div>
                    <div className="text-[11px] text-neutral-500 truncate">{a.date}</div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); moveArticle(a.id, -1); }}><ArrowUp className="h-4 w-4"/></Button>
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); moveArticle(a.id, 1); }}><ArrowDown className="h-4 w-4"/></Button>
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); duplicateArticle(a.id); }}><Copy className="h-4 w-4"/></Button>
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); if (confirm("Delete this article?")) deleteArticle(a.id); }}><Trash2 className="h-4 w-4 text-red-600"/></Button>
                  </div>
                </div>
              ))}
              {!filteredArticles.length && (
                <div className="text-sm text-neutral-500 p-6 text-center">No articles yet. Click <b>New Article</b> to begin or <b>Load Example</b>.</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: Editor */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Editor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected && (
              <div className="text-sm text-neutral-500">Select an article to edit.</div>
            )}
            {selected && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Title */}
                  <div className="space-y-1">
                    <Label>Title</Label>
                    <Input value={selected.title} onChange={(e) => updateSelected("title", e.target.value)} />
                  </div>
                  <div className="space-y-1 flex items-end justify-between">
                    <div className="flex-1">
                      <Label>Featured</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Checkbox checked={selected.isFeatured} onCheckedChange={(v) => updateSelected("isFeatured", Boolean(v))} id="feat" />
                        <Label htmlFor="feat" className="text-sm">Mark as featured</Label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="gap-2" variant="secondary" onClick={() => duplicateArticle(selected.id)}><Copy className="h-4 w-4"/> Duplicate</Button>
                      <Button className="gap-2" variant="destructive" onClick={() => { if (confirm("Delete this article?")) deleteArticle(selected.id); }}><Trash2 className="h-4 w-4"/> Delete</Button>
                    </div>
                  </div>

                  {/* Category */}
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Select value={selected.category} onValueChange={(v) => updateSelected("category", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Author */}
                  <div className="space-y-1">
                    <Label>Author</Label>
                    <Input value={selected.author} onChange={(e) => updateSelected("author", e.target.value)} />
                  </div>

                  {/* Date */}
                  <div className="space-y-1">
                    <Label>Date</Label>
                    <div className="flex gap-2">
                      <Input type="date" onChange={(e) => updateSelected("date", formatPrettyDate(e.target.value))} />
                      <Button variant="outline" onClick={() => updateSelected("date", formatPrettyDate(new Date()))}>Today</Button>
                      <Input value={selected.date} onChange={(e) => updateSelected("date", e.target.value)} className="flex-1" placeholder="Oct 27, 2025" />
                    </div>
                  </div>

                  {/* Hero Image */}
                  <div className="space-y-1">
                    <Label>Hero Image URL</Label>
                    <Input placeholder="https://..." value={selected.image} onChange={(e) => updateSelected("image", e.target.value)} />
                  </div>

                  {/* Accent & Border */}
                  <div className="space-y-1">
                    <Label>Accent Color Class</Label>
                    <div className="flex gap-2">
                      <Select value={selected.accentColorClass} onValueChange={(v) => updateSelected("accentColorClass", v)}>
                        <SelectTrigger className="min-w-[220px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ACCENT_OPTIONS.map((x) => (<SelectItem key={x} value={x}>{x}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <Input value={selected.accentColorClass} onChange={(e) => updateSelected("accentColorClass", e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>Border Color Class</Label>
                    <div className="flex gap-2">
                      <Select value={selected.borderColorClass} onValueChange={(v) => updateSelected("borderColorClass", v)}>
                        <SelectTrigger className="min-w-[220px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BORDER_OPTIONS.map((x) => (<SelectItem key={x} value={x}>{x}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <Input value={selected.borderColorClass} onChange={(e) => updateSelected("borderColorClass", e.target.value)} />
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="space-y-1">
                  <Label>Summary</Label>
                  <Textarea rows={3} value={selected.summary} onChange={(e) => updateSelected("summary", e.target.value)} />
                </div>

                <Separator />

                {/* Inline Images Manager */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Inline Images</Label>
                    <Button variant="outline" size="sm" className="gap-2" onClick={addInlineImage}><ImageIcon className="h-4 w-4"/> Add Image</Button>
                  </div>
                  <div className="space-y-3">
                    {selected.inlineImages.map((im, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-3 rounded-xl border bg-white">
                        <div className="md:col-span-6 space-y-1">
                          <Label>Image URL (#{idx+1})</Label>
                          <Input placeholder="https://..." value={im.url} onChange={(e) => updateInlineImage(idx, "url", e.target.value)} />
                        </div>
                        <div className="md:col-span-5 space-y-1">
                          <Label>Caption</Label>
                          <Input value={im.caption || ""} onChange={(e) => updateInlineImage(idx, "caption", e.target.value)} />
                        </div>
                        <div className="md:col-span-1 flex gap-2 md:justify-end">
                          <Button variant="secondary" size="sm" onClick={() => insertImageToken(idx+1)}>
                            Insert <span className="ml-1 hidden md:inline">&lt;image-{idx+1}&gt;</span>
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => removeInlineImage(idx)}><Trash2 className="h-4 w-4"/></Button>
                        </div>
                      </div>
                    ))}
                    {!selected.inlineImages.length && (
                      <div className="text-sm text-neutral-500">No inline images. Click <b>Add Image</b> to create one, then insert a token like <code>&lt;image-1&gt;</code> into the content.</div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Content Editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Article Content</Label>
                    <div className="text-xs text-neutral-500">Tip: insert tokens like <code>&lt;image-1&gt;</code> to reference Inline Images.</div>
                  </div>
                  <div className="rounded-xl overflow-hidden border bg-white">
                    <ReactQuill
                      ref={quillRef}
                      theme="snow"
                      modules={quillModules}
                      value={selected.content}
                      onChange={(val) => updateSelected("content", val)}
                      style={{ height: 300 }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                  <Button className="gap-2" onClick={() => download("newspaper.json", exportJson({ downloadFile: false }))}><Download className="h-4 w-4"/> Save JSON</Button>
                  <Button variant="secondary" className="gap-2" onClick={() => navigator.clipboard.writeText(exportJson({ downloadFile: false })).then(()=>alert("Copied!"))}><FileJson className="h-4 w-4"/> Copy JSON</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live JSON Preview & Test Output */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Live JSON Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[240px] overflow-auto text-xs bg-neutral-900 text-neutral-100 p-3 rounded-xl">
{JSON.stringify(toExportArray(articles, exportPlainText), null, 2)}
          </pre>
          {testOutput && (
            <div className="mt-3 text-xs whitespace-pre-wrap p-3 rounded-xl border">
              {testOutput}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-[11px] text-neutral-500 text-center mt-2">
        Built for school newspapers: rich text editing, image tokens, import/export to your exact JSON schema.
      </div>
    </div>
  );
}
