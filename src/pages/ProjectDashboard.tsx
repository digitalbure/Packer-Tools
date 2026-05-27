import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Project, AdminSettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Calendar, 
  ChevronRight, 
  Trash2, 
  Loader2, 
  Truck, 
  Shield, 
  MapPin, 
  Flag,
  Layers,
  Clock,
  AlertCircle,
  Building,
  Briefcase,
  Zap,
  Camera,
  Edit2,
  Hammer,
  LayoutGrid,
  List,
  Grid
} from 'lucide-react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { checkLimit } from '../lib/limitUtils';
import { toast } from 'sonner';

export default function ProjectDashboard({ user, adminSettings }: { user: UserProfile, adminSettings: AdminSettings | null }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [viewType, setViewType] = useState<'grid' | 'list' | 'icon'>('grid');
  const [addStep, setAddStep] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setBy] = useState<'newest' | 'oldest' | 'name' | 'status'>('newest');
  const [newProject, setNewProject] = useState<{
    name: string;
    description: string;
    startDate: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    category: 'production' | 'event' | 'logistics' | 'technical' | 'other';
    location: string;
    orgUnit: string;
    stage: 'proposed' | 'actual';
    isBuildMode: boolean;
  }>({
    name: '',
    description: '',
    startDate: '',
    priority: 'medium',
    category: 'technical',
    location: '',
    orgUnit: '',
    stage: 'proposed',
    isBuildMode: false
  });

  const TOTAL_STEPS = 3;

  useEffect(() => {
    const q = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching projects:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user.uid]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name) return;

    if (addStep < TOTAL_STEPS) {
      setAddStep(addStep + 1);
      return;
    }

    const limitCheck = await checkLimit(user, adminSettings, 'projects');
    if (!limitCheck.allowed) {
      toast.error(`Project limit reached (${limitCheck.current}/${limitCheck.limit})`);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        ...newProject,
        ownerId: user.uid,
        status: 'planning',
        listIds: [],
        createdAt: serverTimestamp()
      });
      setIsAdding(false);
      setAddStep(1);
      setNewProject({
        name: '',
        description: '',
        startDate: '',
        priority: 'medium',
        category: 'technical',
        location: '',
        orgUnit: '',
        stage: 'proposed',
        isBuildMode: false
      });
      toast.success("Project created successfully!");
      navigate(`/project/${docRef.id}`);
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error("Failed to create project");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    try {
      await updateDoc(doc(db, 'projects', editingProject.id), {
        name: editingProject.name,
        description: editingProject.description,
        startDate: editingProject.startDate,
        priority: editingProject.priority,
        category: editingProject.category,
        location: editingProject.location,
        orgUnit: editingProject.orgUnit,
        updatedAt: serverTimestamp()
      });
      setEditingProject(null);
      toast.success("Project updated successfully!");
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error("Failed to update project");
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!window.confirm("Are you sure you want to delete this project?")) return;
    try {
      const itemsSnap = await getDocs(collection(db, 'packingLists', projectId, 'items'));
      if (itemsSnap.docs.length > 0) {
        toast.error("Cannot delete project with active items. Clear project first.");
        return;
      }
      await deleteDoc(doc(db, 'projects', projectId));
      toast.success("Project deleted");
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
    }
  };

  const filteredProjects = projects.filter(p => {
    if (filterStatus === 'all') return true;
    return (p.status || 'planning') === filterStatus;
  }).sort((a, b) => {
    if (sortBy === 'newest') {
      const dateA = (a.createdAt as any)?.seconds || (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() / 1000 : 0);
      const dateB = (b.createdAt as any)?.seconds || (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() / 1000 : 0);
      return dateB - dateA;
    }
    if (sortBy === 'oldest') {
      const dateA = (a.createdAt as any)?.seconds || (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() / 1000 : 0);
      const dateB = (b.createdAt as any)?.seconds || (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() / 1000 : 0);
      return dateA - dateB;
    }
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  if (loading) return <div className="flex justify-center py-24 animate-spin"><Loader2 size={48} /></div>;

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-12 sm:px-8 sm:py-20 space-y-12 sm:space-y-20 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-primary">
            <Layers size={24} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Project Dashboard</span>
          </div>
          <h1 className="text-5xl sm:text-7xl font-black uppercase tracking-tighter leading-[0.8] text-neutral-900">
            Active <br/> <span className="text-primary italic">Projects</span>
          </h1>
          <p className="text-neutral-500 font-medium max-w-sm italic">
            Manage projects, verify inventory, and coordinate gear across your organization.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
          <div className="flex bg-white p-1 rounded-2xl border border-neutral-100 shadow-sm overflow-x-auto no-scrollbar">
            {['all', 'planning', 'active', 'completed'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition ${filterStatus === status ? 'bg-neutral-900 text-white shadow-lg' : 'text-neutral-400 hover:text-neutral-600'}`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* View Toggles */}
          <div className="flex bg-white p-1 rounded-2xl border border-neutral-100 shadow-sm shrink-0">
            {[
              { type: 'grid', label: 'Grid', icon: <LayoutGrid size={16} /> },
              { type: 'list', label: 'List', icon: <List size={16} /> },
              { type: 'icon', label: 'Icon', icon: <Grid size={16} /> }
            ].map(item => (
              <button
                key={item.type}
                type="button"
                onClick={() => setViewType(item.type as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all font-bold text-[10px] uppercase tracking-wider ${
                  viewType === item.type 
                    ? 'bg-neutral-900 text-white shadow-md' 
                    : 'text-neutral-400 hover:text-neutral-600'
                }`}
                title={`${item.label} View`}
              >
                {item.icon}
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsAdding(true)}
            className="group px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition flex items-center justify-center gap-3"
          >
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Projects List/Grid/Icon Section */}
      {filteredProjects.length === 0 ? (
        <div className="py-32 text-center space-y-6 bg-white rounded-[3rem] border border-neutral-100 shadow-sm max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-neutral-50 text-neutral-300 rounded-full flex items-center justify-center mx-auto">
            <Flag size={40} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold uppercase tracking-tight">No projects found</h3>
            <p className="text-neutral-400 text-sm italic">Clear filters or create a new project to begin.</p>
          </div>
        </div>
      ) : viewType === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-10">
          {filteredProjects.map((project) => (
            <motion.div
              key={project.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="group bg-white rounded-[2.5rem] p-6 sm:p-8 border border-neutral-100 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 flex flex-col justify-between h-auto min-h-[240px] hover:border-primary/20 relative"
            >
              {/* Status & Stage Badges */}
              <div className="flex items-center justify-between gap-2 mb-4 w-full">
                <div className="w-12 h-12 bg-neutral-100/80 rounded-2xl flex items-center justify-center text-primary group-hover:scale-105 group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-sm shrink-0">
                  {project.category === 'production' ? <Camera size={20} /> : 
                   project.category === 'event' ? <Layers size={20} /> : 
                   project.category === 'logistics' ? <Truck size={20} /> :
                   project.category === 'technical' ? <Shield size={20} /> : <Briefcase size={20} />}
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1 px-2.5 py-1 bg-neutral-50 rounded-full border border-neutral-100/50">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      project.status === 'active' ? 'bg-emerald-500 animate-pulse' : 
                      project.status === 'completed' ? 'bg-blue-500' : 'bg-amber-500'
                    }`}></div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-neutral-500">{project.status || 'planning'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${
                      project.stage === 'actual' ? 'bg-green-500 text-white' : 'bg-neutral-100 text-neutral-400'
                    }`}>
                      {project.stage || 'proposed'}
                    </span>
                    <span className="text-[8px] font-bold text-neutral-300">v{project.version || 1}</span>
                  </div>
                </div>
              </div>

              {/* Main Card Content with natural padding */}
              <div className="space-y-3 flex-1 flex flex-col justify-start">
                <div className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-neutral-400">
                  <Calendar size={10} />
                  <span>{project.startDate || 'No date set'}</span>
                  <span className="text-neutral-200">•</span>
                  <Building size={10} />
                  <span className="truncate max-w-[120px]">{project.orgUnit || 'Individual'}</span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-neutral-900 group-hover:text-primary transition-colors line-clamp-2 leading-none">
                    {project.name}
                  </h3>
                  <p className="text-neutral-500 text-xs sm:text-xs font-semibold line-clamp-2 italic leading-relaxed">
                    {project.description || 'No description provided for this project.'}
                  </p>
                </div>
              </div>

              {/* Premium Attributes block */}
              <div className="my-4 pt-3 border-t border-dashed border-neutral-100 flex items-center gap-4 text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                <div className="flex items-center gap-1 bg-neutral-100/40 px-2.5 py-1 rounded-lg">
                  <Clock size={10} className="text-neutral-400" />
                  <span>{project.priority || 'medium'} priority</span>
                </div>
                {project.location && (
                  <div className="flex items-center gap-1 bg-neutral-100/40 px-2.5 py-1 rounded-lg truncate max-w-[150px]">
                    <MapPin size={10} />
                    <span className="truncate">{project.location}</span>
                  </div>
                )}
              </div>

              {/* Card Footer actions */}
              <div className="pt-4 flex items-center justify-between border-t border-neutral-50">
                <Link
                  to={`/project/${project.id}`}
                  className="flex items-center gap-2 font-black text-neutral-900 hover:text-primary transition group/link"
                >
                  <span className="text-[10px] uppercase tracking-widest">View Project</span>
                  <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center group-hover/link:bg-primary group-hover/link:text-white transition shadow-sm">
                    <ChevronRight size={14} />
                  </div>
                </Link>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingProject(project)}
                    className="p-2 text-neutral-300 hover:text-primary hover:bg-primary/5 rounded-xl transition group/edit"
                    title="Edit project"
                  >
                    <Edit2 size={16} className="group-hover/edit:scale-110 transition" />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="p-2 text-neutral-300 hover:text-accent hover:bg-accent/5 rounded-xl transition group/del"
                    title="Delete project"
                  >
                    <Trash2 size={16} className="group-hover/del:scale-110 transition" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : viewType === 'list' ? (
        <div className="flex flex-col gap-4">
          {filteredProjects.map((project) => (
            <motion.div
              key={project.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="group bg-white rounded-3xl p-4 sm:p-6 border border-neutral-100 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Visual Category Icon */}
                <div className="w-12 h-12 bg-neutral-50 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300 shrink-0 shadow-sm">
                  {project.category === 'production' ? <Camera size={20} /> : 
                   project.category === 'event' ? <Layers size={20} /> : 
                   project.category === 'logistics' ? <Truck size={20} /> :
                   project.category === 'technical' ? <Shield size={20} /> : <Briefcase size={20} />}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900 group-hover:text-primary transition-colors truncate">
                      {project.name}
                    </h3>
                    <span className={`px-1.5 py-0.5 rounded text-[6px] font-black uppercase tracking-widest ${
                      project.stage === 'actual' ? 'bg-green-500 text-white' : 'bg-neutral-100 text-neutral-400'
                    }`}>
                      {project.stage || 'proposed'}
                    </span>
                  </div>
                  {project.description && (
                    <p className="text-neutral-400 text-xs italic truncate max-w-xl">
                      {project.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Data & Badges Column */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 shrink-0 md:justify-end text-neutral-500">
                <div className="flex flex-col text-left md:text-right">
                  <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Timeline / Org</span>
                  <span className="text-xs font-bold text-neutral-700">{project.startDate || 'No date'}</span>
                  <span className="text-[9px] font-medium text-neutral-400">{project.orgUnit || 'Individual'}</span>
                </div>

                <div className="flex flex-col text-left md:text-right">
                  <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Settings</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[9px] px-2 py-0.5 bg-neutral-100 rounded-full font-bold uppercase">{project.priority || 'medium'}</span>
                    <span className="text-[9px] font-bold text-neutral-300">v{project.version || 1}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-3 py-1 bg-neutral-50 rounded-full border border-neutral-100">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    project.status === 'active' ? 'bg-emerald-500 animate-pulse' : 
                    project.status === 'completed' ? 'bg-blue-500' : 'bg-amber-500'
                  }`}></div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-neutral-500">{project.status || 'planning'}</span>
                </div>

                {/* List Actions */}
                <div className="flex items-center gap-1 pl-2 border-l border-neutral-100">
                  <Link
                    to={`/project/${project.id}`}
                    className="p-2 bg-neutral-50 hover:bg-primary hover:text-white text-neutral-700 rounded-xl transition shadow-sm"
                    title="View project details"
                  >
                    <ChevronRight size={16} />
                  </Link>
                  <button
                    onClick={() => setEditingProject(project)}
                    className="p-2 text-neutral-300 hover:text-primary hover:bg-primary/5 rounded-xl transition"
                    title="Edit project"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="p-2 text-neutral-300 hover:text-accent hover:bg-accent/5 rounded-xl transition"
                    title="Delete project"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {filteredProjects.map((project) => (
            <motion.div
              key={project.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="group bg-white rounded-[2.5rem] p-6 border border-neutral-100 shadow-sm hover:shadow-lg hover:border-primary/25 transition-all duration-300 flex flex-col items-center justify-between text-center min-h-[220px] relative overflow-hidden"
            >
              {/* Quick top bar for visual priority/status dot */}
              <div className="absolute top-4 left-4 right-4 flex justify-between items-center w-full px-1">
                <span className={`text-[7px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                  project.stage === 'actual' ? 'bg-green-500 text-white' : 'bg-neutral-100 text-neutral-400'
                }`}>
                  v{project.version || 1}
                </span>

                <div className={`w-2 h-2 rounded-full ${
                  project.status === 'active' ? 'bg-emerald-500 animate-pulse' : 
                  project.status === 'completed' ? 'bg-blue-500' : 'bg-amber-500'
                }`} title={project.status || 'planning'} />
              </div>

              {/* Large Central Icon */}
              <div className="mt-6 w-16 h-16 bg-neutral-100/70 rounded-[1.50rem] flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm">
                {project.category === 'production' ? <Camera size={28} /> : 
                 project.category === 'event' ? <Layers size={28} /> : 
                 project.category === 'logistics' ? <Truck size={28} /> :
                 project.category === 'technical' ? <Shield size={28} /> : <Briefcase size={28} />}
              </div>

              <div className="space-y-1.5 w-full px-2 mt-4">
                <h4 className="font-black text-sm uppercase tracking-tight text-neutral-900 group-hover:text-primary transition-colors truncate">
                  {project.name}
                </h4>
                <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest truncate">{project.orgUnit || 'Individual'}</p>
              </div>

              {/* Quick actions row on entry hover / bento click */}
              <div className="w-full mt-4 flex items-center justify-center gap-2 pt-3 border-t border-neutral-50">
                <Link
                  to={`/project/${project.id}`}
                  className="px-3 py-1.5 bg-neutral-900 text-white hover:bg-primary rounded-xl text-[8px] font-black uppercase tracking-wider transition flex items-center gap-1.5 shadow-sm"
                >
                  <span>Open</span>
                  <ChevronRight size={10} />
                </Link>
                <button
                  onClick={() => setEditingProject(project)}
                  className="p-1.5 text-neutral-300 hover:text-primary hover:bg-neutral-50 rounded-lg transition"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={() => handleDelete(project.id)}
                  className="p-1.5 text-neutral-300 hover:text-accent hover:bg-neutral-50 rounded-lg transition"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <AnimatePresence>
        {editingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingProject(null)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full sm:max-w-2xl bg-white sm:rounded-[3rem] shadow-2xl overflow-hidden h-full sm:h-auto sm:max-h-[90vh] flex flex-col"
            >
              <div className="p-8 sm:p-12 overflow-y-auto flex-1 custom-scrollbar">
                <div className="flex items-center justify-between mb-8 sm:mb-10">
                  <div className="space-y-1">
                    <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-primary">Edit Project</h2>
                    <p className="text-neutral-400 font-bold uppercase tracking-widest text-[8px] sm:text-[10px]">Modify project parameters</p>
                  </div>
                  <button onClick={() => setEditingProject(null)} className="p-2 sm:p-3 hover:bg-neutral-50 rounded-full transition">
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>

                <form onSubmit={handleUpdate} className="space-y-6 sm:space-y-8 text-neutral-900">
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2 text-left">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Project Name</label>
                      <input
                        type="text"
                        required
                        value={editingProject.name}
                        onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                        className="w-full bg-neutral-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-primary transition font-bold text-lg"
                      />
                    </div>

                    <div className="space-y-2 text-left">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Description</label>
                      <textarea
                        value={editingProject.description}
                        onChange={(e) => setEditingProject({ ...editingProject, description: e.target.value })}
                        className="w-full bg-neutral-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-primary transition h-24 resize-none text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Category</label>
                        <select
                          value={editingProject.category}
                          onChange={(e) => setEditingProject({ ...editingProject, category: e.target.value as any })}
                          className="w-full bg-neutral-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-primary transition text-sm font-bold"
                        >
                          <option value="production">Production</option>
                          <option value="event">Event</option>
                          <option value="technical">Technical</option>
                          <option value="logistics">Logistics</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Priority</label>
                        <select
                          value={editingProject.priority}
                          onChange={(e) => setEditingProject({ ...editingProject, priority: e.target.value as any })}
                          className="w-full bg-neutral-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-primary transition text-sm font-bold"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Location</label>
                        <input
                          type="text"
                          value={editingProject.location}
                          onChange={(e) => setEditingProject({ ...editingProject, location: e.target.value })}
                          className="w-full bg-neutral-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-primary transition text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Start Date</label>
                        <input
                          type="date"
                          value={editingProject.startDate}
                          onChange={(e) => setEditingProject({ ...editingProject, startDate: e.target.value })}
                          className="w-full bg-neutral-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-primary transition text-sm font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      className="flex-1 bg-primary text-white py-6 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl hover:bg-neutral-900 transition flex items-center justify-center gap-3 active:scale-95"
                    >
                      <Briefcase size={20} />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsAdding(false); setAddStep(1); }}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full sm:max-w-2xl bg-white sm:rounded-[3rem] shadow-2xl overflow-hidden h-full sm:h-auto sm:max-h-[90vh] flex flex-col"
            >
              <div className="p-8 sm:p-12 overflow-y-auto flex-1 custom-scrollbar">
                <div className="flex items-center justify-between mb-8 sm:mb-10">
                  <div className="space-y-1">
                    <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-primary">New Project</h2>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {[1, 2, 3].map(i => (
                          <div key={i} className={`h-1 rounded-full transition-all ${i <= addStep ? 'w-4 bg-primary' : 'w-2 bg-neutral-100'}`} />
                        ))}
                      </div>
                      <p className="text-neutral-400 font-bold uppercase tracking-widest text-[8px] sm:text-[10px]">
                        Step {addStep} of {TOTAL_STEPS} • {
                          addStep === 1 ? 'Primary Details' : 
                          addStep === 2 ? 'Categorization' : 
                          'Logistics & Priority'
                        }
                      </p>
                    </div>
                  </div>
                  <button onClick={() => { setIsAdding(false); setAddStep(1); }} className="p-2 sm:p-3 hover:bg-neutral-50 rounded-full transition">
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>

                <form onSubmit={handleCreate} className="space-y-6 sm:space-y-8 text-neutral-900">
                  <AnimatePresence mode="wait">
                    {addStep === 1 && (
                      <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-6"
                      >
                        <div className="space-y-2 text-left">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Project Name</label>
                          <input
                            type="text"
                            required
                            autoFocus
                            value={newProject.name}
                            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                            placeholder="e.g. HOTEL X SHOOT"
                            className="w-full bg-neutral-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-primary transition font-bold text-lg"
                          />
                        </div>

                        <div className="space-y-text-left">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Description</label>
                          <textarea
                            value={newProject.description}
                            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                            placeholder="Project goals, equipment requirements..."
                            className="w-full bg-neutral-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-primary transition h-32 sm:h-24 resize-none text-sm"
                          />
                        </div>
                      </motion.div>
                    )}

                    {addStep === 2 && (
                      <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="space-y-6"
                      >
                         <div className="space-y-2 text-left">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Category</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                              { id: 'production', label: 'Production', icon: <Camera size={14} /> },
                              { id: 'event', label: 'Event', icon: <Layers size={14} /> },
                              { id: 'technical', label: 'Technical', icon: <Zap size={14} /> },
                              { id: 'logistics', label: 'Logistics', icon: <Truck size={14} /> },
                              { id: 'other', label: 'Other', icon: <Briefcase size={14} /> }
                            ].map(cat => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => setNewProject({ ...newProject, category: cat.id as any })}
                                className={`flex items-center gap-3 px-6 py-4 rounded-2xl border-2 transition-all font-bold text-sm ${
                                  newProject.category === cat.id 
                                    ? 'bg-primary/5 border-primary text-primary' 
                                    : 'bg-neutral-50 border-transparent text-neutral-500 hover:bg-neutral-100'
                                }`}
                              >
                                {cat.icon}
                                <span>{cat.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2 text-left">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Organization Unit</label>
                          <input
                            type="text"
                            value={newProject.orgUnit}
                            onChange={(e) => setNewProject({ ...newProject, orgUnit: e.target.value })}
                            placeholder={user.company || "Department / Studio"}
                            className="w-full bg-neutral-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-primary transition text-sm font-bold"
                          />
                        </div>
                      </motion.div>
                    )}

                    {addStep === 3 && (
                      <motion.div
                        key="step3"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="grid grid-cols-1 gap-6"
                      >
                        <div className="space-y-2 text-left">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Priority Level</label>
                          <div className="flex flex-wrap gap-2">
                            {['low', 'medium', 'high', 'critical'].map(p => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setNewProject({ ...newProject, priority: p as any })}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
                                  newProject.priority === p
                                    ? 'bg-neutral-900 border-neutral-900 text-white'
                                    : 'bg-white border-neutral-100 text-neutral-400 hover:border-neutral-200'
                                }`}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-2 text-left">
                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Integrator Sandbox</label>
                            <button 
                                type="button"
                                onClick={() => setNewProject({ ...newProject, isBuildMode: !newProject.isBuildMode })}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                                    newProject.isBuildMode 
                                    ? 'bg-amber-50 border-amber-200 text-amber-600' 
                                    : 'bg-neutral-50 border-transparent text-neutral-400 hover:bg-neutral-100'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Hammer size={16} />
                                    <span className="text-[10px] font-black uppercase">Enable Build Mode</span>
                                </div>
                                <div className={`w-10 h-5 rounded-full transition-colors relative ${newProject.isBuildMode ? 'bg-amber-500' : 'bg-neutral-200'}`}>
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${newProject.isBuildMode ? 'left-6' : 'left-1'}`} />
                                </div>
                            </button>
                            <p className="text-[8px] text-neutral-400 font-bold uppercase tracking-tight mt-1 px-2 italic">
                                Plan virtual systems and components before committing to inventory.
                            </p>
                          </div>

                          <div className="space-y-2 text-left">
                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Lifecycle Stage</label>
                            <div className="flex bg-neutral-50 p-1 rounded-2xl">
                                <button 
                                    type="button"
                                    onClick={() => setNewProject({ ...newProject, stage: 'proposed' })}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${
                                        newProject.stage === 'proposed' ? 'bg-white text-primary shadow-sm' : 'text-neutral-400'
                                    }`}
                                >
                                    Proposed
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setNewProject({ ...newProject, stage: 'actual' })}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${
                                        newProject.stage === 'actual' ? 'bg-primary text-white shadow-sm' : 'text-neutral-400'
                                    }`}
                                >
                                    Actual
                                </button>
                            </div>
                          </div>
 
                          <div className="space-y-2 text-left">
                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Location</label>
                            <div className="relative">
                              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                              <input
                                type="text"
                                value={newProject.location}
                                onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                                placeholder="Remote Location, Studio, etc."
                                className="w-full bg-neutral-50 border-none rounded-2xl pl-12 pr-6 py-4 focus:ring-2 focus:ring-primary transition text-sm font-bold"
                              />
                            </div>
                          </div>

                          <div className="space-y-2 text-left">
                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Start Date</label>
                            <div className="relative">
                              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                              <input
                                type="date"
                                value={newProject.startDate}
                                onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
                                className="w-full bg-neutral-50 border-none rounded-2xl pl-12 pr-6 py-4 focus:ring-2 focus:ring-primary transition text-sm font-bold"
                              />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-4 pt-4">
                    {addStep > 1 && (
                      <button
                        type="button"
                        onClick={() => setAddStep(addStep - 1)}
                        className="flex-1 bg-neutral-50 text-neutral-500 py-6 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-neutral-100 transition border border-neutral-100"
                      >
                        Back
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex-[2] bg-primary text-white py-6 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl hover:bg-neutral-900 transition flex items-center justify-center gap-3 active:scale-95"
                    >
                      {addStep < TOTAL_STEPS ? (
                        <>
                          <span>Continue</span>
                          <ChevronRight size={20} />
                        </>
                      ) : (
                        <>
                          <Briefcase size={20} />
                          <span>Create Project</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
