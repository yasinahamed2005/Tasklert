import React, { useRef } from "react";
import { X, Trash2 } from "lucide-react";
import { useModalAccessibility } from "../utils/scrollLock";

const DeleteModal = ({ isOpen, onClose, onConfirm, taskTitle }) => {
  const modalRef = useRef(null);

  useModalAccessibility({
    isOpen,
    onClose,
    modalRef,
  });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overscroll-none overflow-hidden animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-sm shadow-2xl border border-purple-100 animate-fadeIn flex flex-col"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-red-50 text-red-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <h2 id="delete-dialog-title" className="text-lg font-bold text-gray-800">
              Delete Task
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          Are you sure you want to delete <strong className="text-gray-900 font-semibold">{taskTitle}</strong>? This action cannot be undone.
        </p>

        <div className="flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl shadow-xs transition cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
