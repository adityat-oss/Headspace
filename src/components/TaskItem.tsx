import React, { useState } from "react";
import { Task } from "../types";
import { Trash2 } from "lucide-react";

interface TaskItemProps {
  task: Task;
  onUpdate: (task: Task) => void;
  onDelete: (id: string) => void;
  isInteractive: boolean;
  isOverlay?: boolean;
  fontFamily?: string;
  color?: string;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task, onUpdate, onDelete, isInteractive, isOverlay = false, fontFamily = "'Caveat', cursive", color = "rgba(255,255,255,0.9)" }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(task.content);

  const isLargeFont = !fontFamily.includes("Caveat");
  const overlayFontSize = isLargeFont ? "text-[1.35rem]" : "text-2xl";
  const regularFontSize = isLargeFont ? "text-[1.05rem]" : "text-lg";

  const handleToggle = () => {
    if (!isInteractive) return;
    const nowCompleted = !task.completed;
    onUpdate({
      ...task,
      completed: nowCompleted,
      completed_at: nowCompleted ? new Date().toISOString() : undefined
    });
  };

  const handleDoubleClick = () => {
    if (!isInteractive) return;
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onUpdate({ ...task, content: editContent });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleBlur();
    }
  };

  return (
    <div
      className={`group flex items-start justify-between gap-3 py-2.5 px-3 rounded-2xl transition-all ${
        isOverlay
          ? "hover:bg-white/[0.04]"
          : "hover:bg-white/[0.06] border border-transparent hover:border-white/10"
      }`}
      title={task.content}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0 pt-0.5">
        <button
          onClick={handleToggle}
          className={`${isOverlay ? "text-2xl" : "text-xl"} focus:outline-none cursor-pointer shrink-0 transition-transform active:scale-95 leading-none mt-0.5`}
          style={{ fontFamily }}
        >
          <span className={task.completed ? "text-[#52525b] font-normal" : "text-sky-100/80 font-normal hover:text-white"}>
            {task.completed ? "[ ✓ ]" : "[   ]"}
          </span>
        </button>

        {isEditing ? (
          <input
            type="text"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            className={`flex-1 bg-black/60 border border-white/20 rounded-xl px-2.5 py-1 outline-none ${
              isOverlay ? overlayFontSize : regularFontSize
            } tracking-wide placeholder-neutral-500 shadow-inner`}
            style={{ fontFamily, color }}
          />
        ) : (
          <span
            onDoubleClick={handleDoubleClick}
            className={`flex-1 ${
              isOverlay ? overlayFontSize : regularFontSize
            } tracking-wide leading-relaxed break-words whitespace-normal transition-all duration-300 ${
              task.completed
                ? "text-neutral-400/80 line-through decoration-neutral-500/60"
                : "hover:opacity-80"
            } cursor-text`}
            style={{ fontFamily, color: task.completed ? undefined : color }}
          >
            {task.content}
          </span>
        )}
      </div>

      <button
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-400 transition-all p-1.5 rounded-lg hover:bg-white/10 shrink-0"
        title="Delete task"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};
