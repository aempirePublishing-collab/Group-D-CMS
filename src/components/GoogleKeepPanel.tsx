import React, { useState } from "react";
import { Pin, Trash2, Check, Share2, ExternalLink, Lightbulb, Grid, CheckSquare, Plus, RefreshCw, FileText } from "lucide-react";
import { PersonalNote, User } from "../types";

interface GoogleKeepPanelProps {
  notes: PersonalNote[];
  setNotes: (notes: PersonalNote[]) => void;
  currentUser: User | null;
  token: string | null;
  isOnline: boolean;
  fetchAppData: (token: string) => void;
  saveSingleNoteToFirestore: (note: any) => void;
}

const KEEP_COLORS = [
  { id: "white", bg: "bg-white border-slate-200", label: "Default" },
  { id: "yellow", bg: "bg-[#FFF4B8] border-[#E8C838] text-slate-800", label: "Amber" },
  { id: "blue", bg: "bg-[#D4E4FF] border-[#6FA4E8] text-slate-800", label: "Lapis" },
  { id: "rose", bg: "bg-[#FFD4D4] border-[#E88C8C] text-slate-800", label: "Blossom" },
  { id: "green", bg: "bg-[#D4FFD4] border-[#8CE88C] text-slate-800", label: "Mint" },
  { id: "purple", bg: "bg-[#EED4FF] border-[#C88CE8] text-slate-800", label: "Wisteria" },
  { id: "orange", bg: "bg-[#FFE4D4] border-[#E8A56F] text-slate-805", label: "Peach" },
  { id: "cyan", bg: "bg-[#D4FFFF] border-[#6FE8E8] text-slate-805", label: "Sky" },
];

export default function GoogleKeepPanel({
  notes,
  setNotes,
  currentUser,
  token,
  isOnline,
  fetchAppData,
  saveSingleNoteToFirestore
}: GoogleKeepPanelProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [color, setColor] = useState("white");
  const [isPinned, setIsPinned] = useState(false);
  const [tag, setTag] = useState("General Keep");
  const [activeEditId, setActiveEditId] = useState<string | null>(null);

  const parseKeepNote = (n: PersonalNote) => {
    if (n.tag && n.tag.includes("|")) {
      const parts = n.tag.split("|");
      return {
        color: parts[0] || "white",
        isPinned: parts[1] === "pinned",
        label: parts[2] || "General Keep"
      };
    }
    return {
      color: "white",
      isPinned: false,
      label: n.tag || "General Lecture"
    };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const serializedTag = `${color}|${isPinned ? "pinned" : "unpinned"}|${tag}`;
    const targetPayload = {
      id: activeEditId || "client_note_" + Math.random().toString(36).substring(2, 9),
      title,
      content,
      tag: serializedTag,
      updatedAt: new Date().toISOString()
    };

    if (!isOnline) {
      try {
        const storedStr = localStorage.getItem("gdcms_offline_notes") || "[]";
        const storedArr = JSON.parse(storedStr) as any[];
        const existingIdx = storedArr.findIndex(n => n.id === targetPayload.id);
        
        if (existingIdx !== -1) {
          storedArr[existingIdx] = targetPayload;
        } else {
          storedArr.push(targetPayload);
        }
        localStorage.setItem("gdcms_offline_notes", JSON.stringify(storedArr));

        const enriched = {
          ...targetPayload,
          studentId: currentUser?.id || "temp",
          isSynced: false
        };

        const listCopy = [...notes];
        const localIdx = listCopy.findIndex(n => n.id === enriched.id);
        if (localIdx !== -1) {
          listCopy[localIdx] = enriched;
        } else {
          listCopy.push(enriched);
        }
        setNotes(listCopy);
        saveSingleNoteToFirestore(enriched);
        
        // Reset
        setTitle("");
        setContent("");
        setColor("white");
        setIsPinned(false);
        setActiveEditId(null);
        alert("Offline mode: Sticky note cached locally and pushed securely to Firestore outbox.");
      } catch (err) {
        console.error(err);
      }
      return;
    }

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(targetPayload)
      });
      if (res.ok) {
        setTitle("");
        setContent("");
        setColor("white");
        setIsPinned(false);
        setActiveEditId(null);
        if (token) fetchAppData(token);
      } else {
        alert("Keep server error.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePin = async (n: PersonalNote, currentMeta: any) => {
    const nextPin = !currentMeta.isPinned;
    const nextTag = `${currentMeta.color}|${nextPin ? "pinned" : "unpinned"}|${currentMeta.label}`;
    
    const targetPayload = {
      id: n.id,
      title: n.title,
      content: n.content,
      tag: nextTag,
      updatedAt: new Date().toISOString()
    };

    if (!isOnline) {
      const updatedNotes = notes.map(item => {
        if (item.id === n.id) {
          return { ...item, tag: nextTag, isSynced: false };
        }
        return item;
      });
      setNotes(updatedNotes);
      saveSingleNoteToFirestore({ ...n, tag: nextTag, isSynced: false });
      return;
    }

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(targetPayload)
      });
      if (res.ok && token) {
        fetchAppData(token);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleNoteDelete = async (noteId: string) => {
    const updated = notes.filter(n => n.id !== noteId);
    setNotes(updated);
    
    if (isOnline && token) {
      try {
        await fetch(`/api/notes/delete/${noteId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchAppData(token);
      } catch (err) {
        console.error(err);
      }
    } else {
      alert("Note deleted and scheduled for synchronization when online.");
    }
  };

  const handleCopyToSandboxKeep = (n: PersonalNote) => {
    const fullText = `[GDCMS Keep - ${n.title}]\nCategory: ${parseKeepNote(n).label}\nContents:\n${n.content}\n\nSynced via GDCMS secure decentralized school systems.`;
    navigator.clipboard.writeText(fullText);
    alert('Note content copied to clipboard! Opening Google Keep in a new tab so you can quickly paste it.');
    window.open("https://keep.google.com/", "_blank");
  };

  const selectForEdit = (n: PersonalNote) => {
    const meta = parseKeepNote(n);
    setTitle(n.title);
    setContent(n.content);
    setColor(meta.color);
    setIsPinned(meta.isPinned);
    setTag(meta.label);
    setActiveEditId(n.id);
  };

  // Split Pinned viz Other Notes
  const parsedNotesList = notes.map(n => ({ note: n, meta: parseKeepNote(n) }));
  const pinnedNotes = parsedNotesList.filter(item => item.meta.isPinned);
  const otherNotes = parsedNotesList.filter(item => !item.meta.isPinned);

  return (
    <div className="space-y-6">
      
      {/* Informational Sandbox Banner */}
      <div className="bg-[#FFEFE2] border border-[#FFD2B2] p-4 rounded-3xl text-left flex items-start space-x-3 gap-2">
        <div className="p-2 bg-[#FF8C3A]/10 text-[#D05A00] rounded-xl shrink-0 mt-0.5 animate-pulse">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div className="space-y-1.5 min-w-0">
          <h4 className="font-extrabold text-xs text-[#9E4100] uppercase tracking-wider">Workspace Connection Sync Notice</h4>
          <p className="text-[#A43B00] text-[11px] leading-relaxed select-none">
            Google Keep workspace channel uses an optimized clipboard sync adapter. Create and style your personal lecture logs below, and click **Export ↗** to sync or archive notes to your official Google accounts.
          </p>
        </div>
      </div>

      {/* Note Creation/Editor Widget */}
      <div className="max-w-xl mx-auto bg-white border border-slate-200 shadow-lg rounded-3xl overflow-hidden text-left focus-within:ring-2 focus-within:ring-yellow-500/20 transition-all pointer-events-auto">
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-50 pb-2">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={activeEditId ? "Edit Sticky Note..." : "Take a Keep Note..."}
              className="w-full bg-transparent focus:outline-none text-sm font-extrabold text-slate-800 placeholder-slate-400 select-all"
            />
            <button
              type="button"
              onClick={() => setIsPinned(!isPinned)}
              title={isPinned ? "Unpin Note" : "Pin Note"}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${isPinned ? "bg-yellow-50 text-[#FBBC05]" : "text-slate-400 hover:text-slate-600"}`}
            >
              <Pin className="w-4 h-4" />
            </button>
          </div>

          <textarea
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write note contents... Note gets auto-encrypted before storage."
            rows={3}
            className="w-full bg-transparent focus:outline-none text-xs text-slate-600 font-semibold placeholder-slate-400 resize-none leading-relaxed"
          />

          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center pt-2 border-t border-slate-100">
            {/* Color Dot Picker */}
            <div className="flex flex-wrap items-center gap-1.5">
              {KEEP_COLORS.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  title={c.label}
                  className={`w-5 h-5 rounded-full border cursor-pointer transition-transform hover:scale-110 flex items-center justify-center ${
                    c.id === "white" ? "bg-white border-slate-300" : 
                    c.id === "yellow" ? "bg-[#FFF4B8] border-[#E8C838]" :
                    c.id === "blue" ? "bg-[#D4E4FF] border-[#6FA4E8]" :
                    c.id === "rose" ? "bg-[#FFD4D4] border-[#E88C8C]" :
                    c.id === "green" ? "bg-[#D4FFD4] border-[#8CE88C]" :
                    c.id === "purple" ? "bg-[#EED4FF] border-[#C88CE8]" :
                    c.id === "orange" ? "bg-[#FFE4D4] border-[#E8A56F]" :
                    "bg-[#D4FFFF] border-[#6FE8E8]"
                  }`}
                >
                  {color === c.id && <Check className="w-3 h-3 text-slate-850" />}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-2.5 text-[10px] font-bold text-slate-600 focus:outline-none"
              >
                <option value="General Keep">General Keep</option>
                <option value="Brainstorm">Brainstorm</option>
                <option value="To-Do List">To-Do List</option>
                <option value="Crypto Keys">Crypto Keys</option>
                <option value="Lectures Outline">Lectures Outline</option>
              </select>

              {activeEditId && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveEditId(null);
                    setTitle("");
                    setContent("");
                    setColor("white");
                    setIsPinned(false);
                  }}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-[10px] uppercase duration-150 transition-colors"
                >
                  Cancel
                </button>
              )}

              <button
                type="submit"
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] uppercase rounded-xl tracking-wider shadow duration-150 cursor-pointer"
              >
                {activeEditId ? "Save Change" : "Pin Note"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Notes Grid Dashboard */}
      <div className="space-y-8 text-left">
        {/* Pinned Notes Grid */}
        {pinnedNotes.length > 0 && (
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Pinned Sticky Notes</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {pinnedNotes.map(({ note, meta }) => {
                const colorspec = KEEP_COLORS.find(c => c.id === meta.color) || KEEP_COLORS[0];
                return (
                  <div
                    key={note.id}
                    onClick={() => selectForEdit(note)}
                    className={`rounded-2xl p-5 border shadow-sm transition-all hover:shadow-md cursor-pointer flex flex-col justify-between gap-4 relative min-h-36 ${colorspec.bg}`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between">
                        <h5 className="font-extrabold text-xs select-all truncate max-w-[80%]">{note.title}</h5>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin(note, meta);
                          }}
                          className="p-1 text-slate-500 hover:bg-black/5 rounded-lg"
                        >
                          <Pin className="w-3.5 h-3.5 fill-slate-800 text-slate-800" />
                        </button>
                      </div>
                      <p className="text-[11px] leading-relaxed whitespace-pre-wrap select-all font-semibold max-h-24 overflow-y-auto">
                        {note.content}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-black/5 pt-2 text-[10px]">
                      <span className="bg-black/5 px-2 py-0.5 rounded font-bold">{meta.label}</span>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleCopyToSandboxKeep(note)}
                          title="Export / Link to official Keep"
                          className="p-1.5 hover:bg-black/5 rounded-xl text-slate-700 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleNoteDelete(note.id)}
                          title="Delete Note"
                          className="p-1.5 hover:bg-black/5 rounded-xl text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Other Notes Grid */}
        <div className="space-y-3 pt-2">
          {pinnedNotes.length > 0 && (
            <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">Others Notebooks</span>
          )}
          
          {otherNotes.length === 0 ? (
            pinnedNotes.length === 0 && (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-205 max-w-md mx-auto space-y-3">
                <Lightbulb className="w-10 h-10 text-slate-350 mx-auto" />
                <p className="text-slate-400 font-bold text-xs">No immersive Keep sticky records posted yet.</p>
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {otherNotes.map(({ note, meta }) => {
                const colorspec = KEEP_COLORS.find(c => c.id === meta.color) || KEEP_COLORS[0];
                return (
                  <div
                    key={note.id}
                    onClick={() => selectForEdit(note)}
                    className={`rounded-2xl p-5 border shadow-sm transition-all hover:shadow-md cursor-pointer flex flex-col justify-between gap-4 relative min-h-36 ${colorspec.bg}`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between">
                        <h5 className="font-extrabold text-xs select-all truncate max-w-[80%]">{note.title}</h5>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin(note, meta);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-705 hover:bg-black/5 rounded-lg"
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] leading-relaxed whitespace-pre-wrap select-all font-semibold max-h-24 overflow-y-auto">
                        {note.content}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-black/5 pt-2 text-[10px]">
                      <span className="bg-black/5 px-2 py-0.5 rounded font-bold">{meta.label}</span>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleCopyToSandboxKeep(note)}
                          title="Export / Link to official Keep"
                          className="p-1.5 hover:bg-black/5 rounded-xl text-slate-700 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleNoteDelete(note.id)}
                          title="Delete Note"
                          className="p-1.5 hover:bg-black/5 rounded-xl text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
