import React, { useState,useMemo } from 'react';
import { layoutClasses,SORT_OPTIONS,sortTasks  } from '../assets/dummy';
import { ListChecks,Filter,Plus   } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import TaskItem from '../components/TaskItem';
import TaskModal from '../components/TaskModal';
import { Clock } from 'lucide-react';

const PendingPage = () => {
  const { tasks = [], refreshTasks } = useOutletContext();
  const [sortBy, setSortBy] = useState('newest');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showModal, setShowModal] = useState(false);

  

  const sortedPendingTasks = useMemo(() => {
  const filtered = tasks.filter(
    (t) =>
      !t.completed ||
      (typeof t.completed === "string" && t.completed.toLowerCase() === "no")
  );

  return sortTasks(filtered, sortBy);
}, [tasks, sortBy]);

  return (
    <div className={layoutClasses.container}>
      <div className={layoutClasses.headerWrapper}>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-bold  text-gray-800 flex items-center gap-2">
            <ListChecks className="text-purple-500" /> Pending Tasks
          </h1>
          <p className="text-sm text-gray-500 mt-1">
             {sortedPendingTasks.length} task{sortedPendingTasks.length !== 1 && 's'}{' '}
             needing your attention
          </p>
        </div>
        <div className={layoutClasses.sortBox}>
          <div className="flex items-center gap-2 text-gray-700 font-medium">
             <Filter className="w-4 h-4 text-purple-500" />
              <span className="text-sm">Sort by:</span>
               </div>
               <select
  value={sortBy}
  onChange={(e) => setSortBy(e.target.value)}
  className={layoutClasses.select}
>
  <option value="newest">Newest First</option>
  <option value="oldest">Oldest First</option>
  <option value="priority">By Priority</option>
  <option value="deadline">By Deadline</option>
  <option value="alphabetical">Alphabetically</option>
</select>

<div className={layoutClasses.tabWrapper}>
  {SORT_OPTIONS.map((opt) => (
    <button
      key={opt.id}
      onClick={() => setSortBy(opt.id)}
      className={layoutClasses.tabButton(sortBy === opt.id)}
    >
      {opt.icon}
      {opt.label}
    </button>
  ))}
</div>

               </div>
      </div>
      <div
        className={`${layoutClasses.addBox} add-task-cta`}
  onClick={() => setShowModal(true)}
>
        <div className="flex items-center justify-center gap-3 transition-colors">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center 
                    shadow-sm group-hover:shadow-md transition-all duration-200">
            <Plus className="cta-icon" size={18} />
    </div>
          <span className="font-semibold cta-label">
      Add New Task
    </span>
  </div>
</div>
      <div className="space-y-4">
  {sortedPendingTasks.length === 0 ? (
    <div className={layoutClasses.emptyState}>
      <div className="max-w-xs mx-auto py-6 text-center">
        <div className={layoutClasses.emptyIconBg}>
          <Clock className="w-8 h-8 text-purple-500" />
        </div>
        <h3 className="text-gray-800 mb-2 text-lg font-semibold">
          All caught up!
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          No pending tasks – great work!
        </p>
        <button
          onClick={() => setShowModal(true)}
          className={layoutClasses.emptyBtn}
        >
          Create New Task
        </button>
      </div>
    </div>
  ) : (
    sortedPendingTasks.map((task) => (
      <TaskItem key={task._id || task.id} task={task} 
      showCompleteCheckbox
  onDelete={() => handleDelete(task._id || task.id)}
  onToggleComplete={() =>
    handleToggleComplete(task._id || task.id, task.completed)
  }
  onEdit={() => {
    setSelectedTask(task);
    setShowModal(true);
  }}
  onRefresh={refreshTasks}/>
    ))
  )}
</div>
    <TaskModal
  isOpen={!!selectedTask || showModal}
  onClose={() => {
    setShowModal(false);
    setSelectedTask(null);
    refreshTasks();
  }}
  taskToEdit={selectedTask}
/>

</div>
    
  );
};

export default PendingPage;
