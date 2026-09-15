import React, { useState } from 'react';
import { FileSpreadsheet, Check, X, Search, ExternalLink, ArrowRight, Plus, Loader2 } from 'lucide-react';
import { GoogleSheetFile } from '../types';

interface SheetSelectorModalProps {
  isOpen: boolean;
  sheets: GoogleSheetFile[];
  selectedSheetId: string | null;
  userEmail?: string | null;
  onSelectSheet: (sheet: GoogleSheetFile) => void;
  onClose: () => void;
  onManualIdSubmit: (idOrUrl: string) => void;
  onCreateNewSheet?: () => Promise<void>;
  isCreatingSheet?: boolean;
}

export const SheetSelectorModal: React.FC<SheetSelectorModalProps> = ({
  isOpen,
  sheets,
  selectedSheetId,
  userEmail,
  onSelectSheet,
  onClose,
  onManualIdSubmit,
  onCreateNewSheet,
  isCreatingSheet = false,
}) => {
  const [manualInput, setManualInput] = useState('');

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    // Extract ID if full URL pasted
    let id = manualInput.trim();
    const match = id.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      id = match[1];
    }

    onManualIdSubmit(id);
    setManualInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-stone-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">Select Google Sheet</h3>
              <p className="text-[11px] text-stone-700">
                {userEmail ? `Dedicated dataset for ${userEmail}` : 'Choose your "My Health AI" spreadsheet'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Found Spreadsheets List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-stone-600 uppercase tracking-wider block">
              Spreadsheets in Drive ({sheets.length})
            </span>
            {onCreateNewSheet && (
              <button
                type="button"
                onClick={onCreateNewSheet}
                disabled={isCreatingSheet}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md transition-colors disabled:opacity-50"
              >
                {isCreatingSheet ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                <span>{isCreatingSheet ? 'Creating...' : 'Create New Sheet'}</span>
              </button>
            )}
          </div>

          {sheets.length > 0 ? (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {sheets.map((sheet) => {
                const isSelected = selectedSheetId === sheet.id;

                return (
                  <button
                    key={sheet.id}
                    onClick={() => {
                      onSelectSheet(sheet);
                      onClose();
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between group ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50'
                        : 'border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-stone-900">{sheet.name}</span>
                        {isSelected && (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-600 block mt-0.5 font-mono">
                        ID: {sheet.id.slice(0, 16)}...
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {isSelected ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 bg-stone-50 rounded-xl text-center space-y-2 text-xs text-stone-700 border border-dashed border-stone-200">
              <p>No spreadsheets named "My Health AI" found in this Google Drive account.</p>
              {onCreateNewSheet && (
                <button
                  type="button"
                  onClick={onCreateNewSheet}
                  disabled={isCreatingSheet}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 mx-auto transition-all disabled:opacity-50"
                >
                  {isCreatingSheet ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Create "My Health AI" Spreadsheet</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Enter Sheet ID or Link Manually */}
        <form onSubmit={handleManualSubmit} className="pt-2 border-t border-stone-100 space-y-2">
          <label className="text-[11px] font-semibold text-stone-600 uppercase block">
            Or Paste Spreadsheet Link / ID:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="https://docs.google.com/spreadsheets/d/... or Sheet ID"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-hidden focus:border-emerald-600"
            />
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="px-3 py-2 bg-stone-900 disabled:opacity-40 text-white text-xs font-semibold rounded-xl hover:bg-stone-800 transition-colors"
            >
              Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

