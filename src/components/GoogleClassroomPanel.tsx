import React from "react";
import { School, RefreshCw, ExternalLink, Plus, BookOpen, Clock, AlertTriangle } from "lucide-react";
import { User, Course, Material } from "../types";

interface GoogleClassroomPanelProps {
  googleToken: string | null;
  currentUser: User | null;
  courses: Course[];
  materials: Material[];
  classroomCourses: any[];
  setClassroomCourses: (courses: any[]) => void;
  classroomCoursework: any[];
  setClassroomCoursework: (coursework: any[]) => void;
  selectedClassroomCourseId: string;
  setSelectedClassroomCourseId: (courseId: string) => void;
  isFetchingClassroom: boolean;
  setIsFetchingClassroom: (fetching: boolean) => void;
  handleConnectGoogle: () => void;
  token: string | null;
  fetchAppData: (token: string) => void;
  selectedCourseId: string;
}

export default function GoogleClassroomPanel({
  googleToken,
  currentUser,
  courses,
  materials,
  classroomCourses,
  setClassroomCourses,
  classroomCoursework,
  setClassroomCoursework,
  selectedClassroomCourseId,
  setSelectedClassroomCourseId,
  isFetchingClassroom,
  setIsFetchingClassroom,
  handleConnectGoogle,
  token,
  fetchAppData,
  selectedCourseId
}: GoogleClassroomPanelProps) {
  
  const fetchGoogleClassroomCourses = async () => {
    if (!googleToken) return;
    setIsFetchingClassroom(true);
    try {
      const res = await fetch("https://classroom.googleapis.com/v1/courses", {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClassroomCourses(data.courses || []);
      } else {
        console.error("Failed to fetch Classroom courses natively");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingClassroom(false);
    }
  };

  const fetchGoogleClassroomCoursework = async (courseId: string) => {
    if (!googleToken || !courseId) return;
    setIsFetchingClassroom(true);
    try {
      const res = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`, {
        headers: { Authorization: `Bearer ${googleToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClassroomCoursework(data.courseWork || []);
      } else {
        console.error("Failed to fetch coursework natively from course");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingClassroom(false);
    }
  };

  React.useEffect(() => {
    if (googleToken && !classroomCourses.length) {
      fetchGoogleClassroomCourses();
    }
  }, [googleToken]);

  const handleCourseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const courseId = e.target.value;
    setSelectedClassroomCourseId(courseId);
    if (courseId) {
      fetchGoogleClassroomCoursework(courseId);
    } else {
      setClassroomCoursework([]);
    }
  };

  const handleImportCoursework = async (cw: any) => {
    const exists = materials.some(m => m.title === cw.title && m.type === "assignment_prompt");
    if (exists) {
      alert("This syllabus assignment is already imported inside GDCMS.");
      return;
    }

    const yes = window.confirm(`Import "${cw.title}" into GDCMS local database? This generates an active task slot locally inside this syllabus, allowing GDCMS students to submit encrypted homework here.`);
    if (!yes) return;

    try {
      const targetCourseId = selectedCourseId !== "all" ? selectedCourseId : (courses[0]?.id || "temp");
      const matPayload = {
        id: "mat_import_" + Math.random().toString(36).substring(2, 9),
        courseId: targetCourseId,
        title: cw.title,
        description: cw.description || "Classroom Imported Assignment description",
        type: "assignment_prompt",
        uploadedBy: currentUser?.fullName || "Classroom Sync",
        uploadedAt: new Date().toISOString(),
        fileKey: "imported_prompt.txt",
        originalName: "Google Classroom Link",
        mimeType: "text/plain",
        fileSize: 100,
        deadline: cw.dueDate ? `${cw.dueDate.year}-${String(cw.dueDate.month).padStart(2, '0')}-${String(cw.dueDate.day).padStart(2, '0')}` : undefined
      };

      const res = await fetch("/api/materials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(matPayload)
      });

      if (res.ok) {
        alert(`Successfully imported "${cw.title}" as an active locally syncable assignment prompt inside GDCMS!`);
        if (token) fetchAppData(token);
      } else {
        alert("Could not import coursework list.");
      }
    } catch (err) {
      console.error(err);
      alert("Error during GDCMS port import.");
    }
  };

  const handleCreateCoursework = async () => {
    if (!selectedClassroomCourseId) {
      alert("Please select a Classroom course from the selector first!");
      return;
    }
    const title = window.prompt("Enter Assignment Title:");
    if (!title) return;
    const desc = window.prompt("Enter Assignment Guidelines:");
    if (!desc) return;

    setIsFetchingClassroom(true);
    try {
      const res = await fetch(`https://classroom.googleapis.com/v1/courses/${selectedClassroomCourseId}/courseWork`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${googleToken}`
        },
        body: JSON.stringify({
          title: title,
          description: desc,
          workType: "ASSIGNMENT",
          state: "PUBLISHED"
        })
      });
      if (res.ok) {
        alert(`Successfully pushed and published assignment prompt "${title}" directly to Google Classroom course!`);
        fetchGoogleClassroomCoursework(selectedClassroomCourseId);
      } else {
        alert("Classroom API rejected the creation block. Please make sure you are registered as a Teacher in this course in Google Classroom.");
      }
    } catch (err) {
      console.error(err);
      alert("Creation request exception on Workspace.");
    } finally {
      setIsFetchingClassroom(false);
    }
  };

  return (
    <div className="space-y-6">
      {!googleToken ? (
        <div id="google-classroom-connect" className="relative overflow-hidden bg-white p-10 md:p-14 border border-slate-200/80 rounded-3xl text-center space-y-6 shadow-xl max-w-2xl mx-auto my-12 animate-fade-in transition-all hover:shadow-2xl">
          {/* Ambient light decorations */}
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-100/40 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />
          
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-50 to-indigo-100/50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto border border-indigo-200/60 shadow-inner transform hover:scale-105 transition-transform">
            <School className="w-8 h-8 text-indigo-600" />
          </div>
          
          <div className="space-y-2">
            <h3 className="font-display font-extrabold text-slate-800 text-base md:text-lg tracking-tight leading-snug">
              Activate Google Classroom Workspace Channel
            </h3>
            <p className="text-slate-500 text-xs text-center max-w-md mx-auto leading-relaxed font-semibold">
              Sync dynamically with your official school cohorts. Retain full access to courses, assignments, and grades instantly.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleConnectGoogle}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg hover:shadow-indigo-600/20 active:scale-98 cursor-pointer inline-flex items-center gap-2 font-display"
            >
              <span>Connect Google Account</span>
              <ExternalLink className="w-4 h-4 opacity-80" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 font-bold">
            <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-indigo-500" /> Live Course Syncing</span>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-emerald-500" /> Auto Deadlines</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in text-left">
          {/* Course Selection */}
          <div className="bg-white p-6 border border-slate-200/80 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="font-display font-black text-xs uppercase tracking-widest text-indigo-600">Google Workspace Channel</h4>
                <p className="text-xs text-slate-500 font-medium mt-1">Select a connected course to synchronize classroom assignments:</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="https://classroom.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-indigo-600 border border-slate-200 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <span>Go to Classroom ↗</span>
                </a>
                <button
                  type="button"
                  onClick={fetchGoogleClassroomCourses}
                  title="Refresh courses"
                  className="p-2.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 hover:text-indigo-600 cursor-pointer transition-all active:scale-95 bg-slate-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isFetchingClassroom ? "animate-spin" : ""}`} />
                </button>
                <select
                  value={selectedClassroomCourseId}
                  onChange={handleCourseChange}
                  className="bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none rounded-xl py-2.5 px-4 text-xs text-slate-800 font-bold transition-all min-w-64 cursor-pointer"
                >
                  <option value="">-- Choose Classroom Course --</option>
                  {classroomCourses.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.section ? `(${c.section})` : ""}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Content panel */}
          {selectedClassroomCourseId ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in pr-0 ml-0 mr-0 pt-2">
              <div className="lg:col-span-8 space-y-4 text-left">
                <div className="flex items-center justify-between px-1">
                  <h4 className="font-display font-black text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2">
                     <School className="w-4 h-4 text-indigo-600" />
                     <span>Classroom Assignment Outlines ({classroomCoursework.length})</span>
                  </h4>
                  <button
                    onClick={() => fetchGoogleClassroomCoursework(selectedClassroomCourseId)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingClassroom ? "animate-spin" : ""}`} />
                  </button>
                </div>
                
                {isFetchingClassroom ? (
                  <div className="text-center p-16 bg-white rounded-3xl border border-slate-200/60 space-y-3 shadow-sm">
                    <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                    <p className="text-xs text-slate-500 font-bold tracking-wide">Querying live school boards API...</p>
                  </div>
                ) : classroomCoursework.length === 0 ? (
                  <div className="p-16 text-center bg-white rounded-3xl border border-slate-200/60 text-slate-400 text-xs font-semibold shadow-sm">
                    No coursework items found in this connected Google Class.
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    {classroomCoursework.map(cw => (
                      <div key={cw.id} className="group bg-white rounded-3xl p-6 border border-slate-200/85 shadow-sm space-y-4 hover:border-indigo-300 hover:shadow-md transition-all duration-200">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1.5">
                            <h5 className="font-display font-bold text-slate-800 text-sm md:text-base leading-snug select-all group-hover:text-indigo-950">
                              {cw.title}
                            </h5>
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-extrabold px-2.5 py-1 rounded-lg uppercase inline-block tracking-wider">
                              Work Scope: {cw.workType}
                            </span>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="text-xs bg-indigo-50 text-indigo-700 font-extrabold px-3 py-1.5 rounded-xl border border-indigo-100/80">
                              Scale Points: {cw.maxPoints || "Ungraded"}
                            </span>
                          </div>
                        </div>

                        {cw.description && (
                          <p className="text-xs text-slate-500 select-all whitespace-pre-line leading-relaxed border-t border-slate-100 pt-3 text-left font-medium">
                            {cw.description}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] text-slate-400 pt-3 border-t border-slate-100 font-bold">
                          <span>Synchronized: {new Date(cw.updateTime).toLocaleDateString()}</span>
                          {cw.dueDate ? (
                            <span className="text-rose-600 font-black flex items-center gap-1 bg-rose-50/60 border border-rose-100/50 px-2 py-0.5 rounded-lg">
                              <Clock className="w-3 h-3" />
                              Due Deadline: {cw.dueDate.year}-{String(cw.dueDate.month).padStart(2, '0')}-{String(cw.dueDate.day).padStart(2, '0')}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-semibold">No deadline assigned</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-2 justify-end">
                          <a 
                            href={cw.alternateLink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-800 text-[10px] uppercase font-bold tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 border border-slate-200/50"
                          >
                            <span>View Portal ↗</span>
                          </a>
                          
                          {currentUser?.role === "lecturer" && (
                            <button
                              type="button"
                              onClick={() => handleImportCoursework(cw)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase font-bold tracking-widest rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-600/10 active:scale-97"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Import locally</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4 text-left">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                    <School className="w-5 h-5 text-indigo-600" />
                    <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Workspace Hub</h4>
                  </div>
                  
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    {currentUser?.role === "lecturer" 
                      ? "Create custom Classroom coursework prompts directly using the quick submission trigger below. Lecturers can publish assignments natively onto the student's Google accounts." 
                      : "Your homework assignments are synced in real-time. Use 'View Portal' to review assignments on your personal Google account."
                    }
                  </p>

                  {currentUser?.role === 'lecturer' && (
                     <div className="bg-indigo-50/50 p-4 border border-indigo-100/50 rounded-2xl space-y-3 mt-2">
                       <span className="text-[10px] uppercase font-black text-indigo-700 block tracking-wider font-display">Syllabus Orchestrator</span>
                       <button
                         type="button"
                         onClick={handleCreateCoursework}
                         className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer text-center block shadow-md shadow-indigo-600/10 active:scale-97 font-display"
                       >
                         + Publish New Coursework
                       </button>
                     </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 border border-slate-200 rounded-3xl text-center text-slate-500 text-xs font-semibold">
              Please select an active Google Classroom Course to begin.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
