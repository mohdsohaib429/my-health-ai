import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import {
  Send,
  Sparkles,
  Camera,
  X,
  Plus,
  CheckCircle2,
  Database,
  ArrowRight,
  HelpCircle,
  Clock,
  Dumbbell,
  Scale,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { ChatMessage, FoodDatabaseItem, FoodLogEntry, ActivityLogEntry, DuplicateOffer } from '../types';

interface ChatViewProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string, imageData?: { mimeType: string; base64: string }) => void;
  onConfirmAddFoodToDb: (item: FoodDatabaseItem) => void;
  isSheetConnected: boolean;
  pendingDuplicateOffer?: DuplicateOffer | null;
  onConfirmDuplicate?: () => void;
  onCancelDuplicate?: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onConfirmAddFoodToDb,
  isSheetConnected,
  pendingDuplicateOffer,
  onConfirmDuplicate,
  onCancelDuplicate,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<{
    file: File;
    previewUrl: string;
    base64: string;
    mimeType: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed && !selectedImage) return;

    const imageData = selectedImage
      ? { mimeType: selectedImage.mimeType, base64: selectedImage.base64 }
      : undefined;

    onSendMessage(trimmed, imageData);
    setInputText('');
    setSelectedImage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
    e.preventDefault();
    handleSend();
  }
};

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      setSelectedImage({
        file,
        previewUrl: URL.createObjectURL(file),
        base64: base64Data,
        mimeType: file.type || 'image/jpeg',
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const quickPrompts = [
    'Breakfast: 2 eggs, 2 rotis and one cup of milk',
    'Lunch: 150g chicken breast and 200g rice',
    'Walked for 35 minutes',
    'How many calories have I eaten today?',
    'Inspect all six sheets for integrity',
    'Progress & Consistency Analysis',
    'Analyze my day',
    'My weight today is 81.5 kg',
  ];

  return (
   <div className="flex flex-col h-[100dvh] max-w-4xl mx-auto">
      {/* Chat Messages List */}
      <div className="flex-1 overflow-y-auto px-3 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-5">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-stone-900">
              Welcome to My Health AI
            </h3>
            <p className="text-sm text-stone-700 max-w-xs mx-auto mt-3 leading-relaxed">
              Log meals, track workouts, check remaining protein, or request dietary analysis simply by typing naturally.
            </p>

            <div className="mt-8 text-left max-w-sm mx-auto">
              <span className="text-[11px] font-semibold text-stone-600 uppercase tracking-wider block mb-4">
                Try saying:
              </span>
              <div className="space-y-3">
                {quickPrompts.slice(0, 4).map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInputText(prompt)}
                    className="w-full text-left p-4 bg-white hover:bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-800 transition-all flex items-center justify-between group shadow-2xs"
                  >
                    <span className="leading-tight">{prompt}</span>
                    <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-emerald-600 transition-colors ml-3 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                {/* Bubble */}
                <div
                  className={`max-w-[90%] rounded-3xl p-5 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-stone-900 dark:bg-emerald-700 text-white rounded-br-2xl'
                      : 'bg-white text-stone-900 border border-stone-200 shadow-2xs rounded-bl-2xl'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap text-white">{msg.text}</p>
                  ) : (
                    <div className="prose prose-sm prose-stone max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-1">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  )}

                  {/* Action Summary Badge & Details */}
                  {msg.action && msg.action.type !== 'NONE' && (
                    <div className="mt-4 pt-3 border-t border-stone-100 space-y-3 text-[11px]">
                      {/* Food items breakdown with Database vs Estimated tags */}
                      {msg.action.foodItems && msg.action.foodItems.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {msg.action.foodItems.map((fItem, fIdx) => (
                            <span
                              key={fIdx}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium border ${
                                fItem.sourceLabel === 'Food Database value: estimated'
                                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                                  : fItem.sourceType === 'FROM_DATABASE' || (!fItem.isEstimate && fItem.sourceType !== 'NEW_ESTIMATE')
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              <span className="font-semibold">{fItem.food}</span>
                              <span>({fItem.quantity} {fItem.unit})</span>
                              <span className="text-[10px] font-semibold opacity-70">
                                {fItem.sourceLabel === 'Food Database value: estimated'
                                  ? '• Estimated'
                                  : fItem.sourceType === 'FROM_DATABASE' || (!fItem.isEstimate && fItem.sourceType !== 'NEW_ESTIMATE')
                                  ? '• Database'
                                  : '• New Estimate'}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Auto-added to Food Database confirmation badge */}
                      {msg.dbItemsAdded && msg.dbItemsAdded.length > 0 && (
                        <div className="p-2 bg-emerald-50/70 border border-emerald-200 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-emerald-800">
                            <Database className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span className="text-[11px] font-semibold">
                              Auto-added to Food Database (Estimated):{' '}
                              <span className="font-normal text-emerald-900">
                                {msg.dbItemsAdded.map((d) => d.food).join(', ')}
                              </span>
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Google Sheet Sync Confirmation Status */}
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          {isSheetConnected
                            ? 'Synchronized to Google Sheet'
                            : 'Saved locally (Connect Google Sheet to sync)'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Offer to add to Food Database Card (if any pending manual offer) */}
                  {msg.offerAddToDb && msg.offerAddToDb.length > 0 && (
                    <div className="mt-3 p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs mb-1">
                        <Database className="w-3.5 h-3.5" />
                        <span>Add to Food Database?</span>
                      </div>
                      <p className="text-[11px] text-emerald-700 mb-2">
                        Would you like to save this food to your Google Sheet Food Database for future instant lookups?
                      </p>
                      <div className="space-y-1.5">
                        {msg.offerAddToDb.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-white p-2 rounded-lg border border-emerald-100 text-xs"
                          >
                            <div>
                              <span className="font-semibold text-stone-900">{item.food}</span>
                              <span className="text-[10px] text-stone-500 block">
                                1 {item.unit} • {item.calories} kcal • {item.protein}g protein
                              </span>
                            </div>
                            <button
                              onClick={() => onConfirmAddFoodToDb(item)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-md shadow-2xs transition-all flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Duplicate Entry Confirmation Alert on Message */}
                  {msg.duplicateOffer && (msg.duplicateOffer.uniqueEntries.length > 0 || msg.duplicateOffer.duplicateEntries.length > 0) && (
                    <div className="mt-3 p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-xs">
                      <div className="flex items-center gap-1.5 text-amber-900 font-bold mb-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span>Duplicate Entry Detected</span>
                      </div>
                      <p className="text-[11px] text-amber-800 mb-2.5">
                        A matching entry already exists for <strong>{msg.duplicateOffer.date}</strong>. Would you like to add it again?
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSendMessage('Yes, add it again')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-all flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Yes, Add Again</span>
                        </button>
                        <button
                          onClick={() => onSendMessage('No, cancel')}
                          className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold rounded-lg transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-stone-600 mt-1 px-1">
                  {msg.timestamp}
                </span>
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex items-center gap-2 p-3 bg-white border border-stone-200 rounded-2xl max-w-[140px] text-xs text-stone-500 shadow-2xs">
            <Sparkles className="w-4 h-4 text-emerald-600 animate-spin" />
            <span>Calculating...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

    {/* Input Box Area */}
      <div className="sticky bottom-0 z-20 bg-white/85 dark:bg-[#141A17]/90 backdrop-blur-md border-t border-stone-200/70 dark:border-stone-800/80 px-3 pt-2 pb-20 md:pb-3 transition-colors">
        {/* Pending Duplicate Entry Bar */}
        {pendingDuplicateOffer && (
          <div className="mb-2 p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span className="truncate">
                Matching entry exists for <strong>{pendingDuplicateOffer.date}</strong>. Add it again?
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => onSendMessage('Yes, add it again')}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Yes, Add</span>
              </button>
              <button
                type="button"
                onClick={() => onSendMessage('No, cancel')}
                className="px-2.5 py-1 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Selected Image Preview */}
        {selectedImage && (
          <div className="mb-2 p-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src={selectedImage.previewUrl}
                alt="Meal preview"
                className="w-10 h-10 object-cover rounded-lg border border-stone-200 dark:border-stone-700"
              />
              <div>
                <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 block truncate max-w-[180px]">
                  {selectedImage.file.name}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">
                  Photo meal estimation ready
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelectedImage(null)}
              className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Sleek Integrated Capsule Bar */}
        <div className="flex items-center gap-1.5 bg-stone-100/90 dark:bg-[#1C2420] border border-stone-200/90 dark:border-stone-700/60 rounded-full px-2 py-1 shadow-2xs focus-within:ring-2 focus-within:ring-emerald-500/25 focus-within:border-emerald-600/50 transition-all">
          {/* Photo upload button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
          />
          <button
            id="chat-photo-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-stone-400 hover:text-emerald-600 dark:text-stone-400 dark:hover:text-emerald-400 rounded-full hover:bg-stone-200/60 dark:hover:bg-stone-800/60 transition-colors flex-shrink-0"
            title="Attach a photo of your meal"
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* Text Input */}
          <textarea
            id="chat-input-textarea"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Log food, activity, or ask anything..."
            rows={1}
            className="flex-1 bg-transparent px-2 py-2 text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none resize-none max-h-24 leading-relaxed"
          />

          {/* Send Button */}
          <button
            id="chat-send-button"
            onClick={handleSend}
            disabled={(!inputText.trim() && !selectedImage) || isLoading}
            className="p-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white rounded-full shadow-xs transition-all flex-shrink-0 active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Compact Micro-footer */}
        <div className="flex items-center justify-between text-[10px] text-stone-400 dark:text-stone-500 px-2 mt-1">
          <span>Personal health assistant • Estimates for tracking</span>
          <span className="hidden sm:inline">Press Enter to send</span>
        </div>
      </div>
    </div>
  );
};
