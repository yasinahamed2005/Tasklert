import React from "react";
import { X } from "lucide-react";

const DeleteModal = ({ isOpen, onClose, onConfirm, taskTitle }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 w-80">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Delete Task</h2>
          <button onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <p className="mb-4">
          Are you sure you want to delete <strong>{taskTitle}</strong>?
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
          onClick={() => {console.log("Delete button clicked!"); // Debugging log
           onConfirm();
          }}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
            Delete
            </button>

        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
