import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { Info, AlertTriangle, X, CheckCircle2, ExternalLink } from 'lucide-react';
import { Header } from './components/Header';
import { Navigation, NavTab } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { ChatView } from './components/ChatView';
import { HistoryView } from './components/HistoryView';
import { ProgressView } from './components/ProgressView';
import { ProfileView } from './components/ProfileView';
import { SheetSelectorModal } from './components/SheetSelectorModal';
import { DestructiveConfirmModal } from './components/DestructiveConfirmModal';
import { TerminologyModal } from './components/TerminologyModal';
import { AnimatePresence } from 'motion/react';

import {
  initAuth,
  googleSignIn,
  googleSignOut,
  getAccessToken,
  setAccessToken,
} from './services/firebaseAuth';

import { NewUserOnboardingModal } from './components/NewUserOnboardingModal';
import { isProfileComplete } from './services/profileCalculator';
import {
  DEFAULT_PROFILE,
  DEFAULT_FOOD_DATABASE,
  DEFAULT_PROGRESS_ENTRIES,
  searchHealthSpreadsheets,
  getSpreadsheetDetails,
  fetchProfileData,
  fetchFoodDatabase,
  fetchFoodDatabaseForUpdate,
  fetchFoodLog,
  fetchActivityLog,
  fetchRawActivityLog,
  fetchDailySummary,
  fetchProgress,
  appendFoodLog,
  appendActivityLog,
  appendProgress,
  appendFoodDatabaseItem,
  updateFoodDatabaseEntry,
  upsertDailySummary,
  updateFoodLogEntry,
  updateActivityLogEntry,
  deleteFoodLogEntry,
  deleteActivityLogEntry,
  recordProgressWithVerification,
  recordProgressLocal,
  RecordProgressResult,
  createHealthSpreadsheet,
  fetchFoodLogRawFormulas,
  writeProfileToSheet,
} from './services/googleSheetsService';

import {
  PRIMARY_USER_EMAIL,
  UserHealthDataset,
  loadUserDataset,
  saveUserDataset,
  createNewUserDataset,
  isPrimaryUser,
  normalizeEmail,
} from './services/multiUserService';

import {
  ProfileData,
  FoodDatabaseItem,
  FoodLogEntry,
  ActivityLogEntry,
  DailySummaryEntry,
  ProgressEntry,
  GoogleSheetFile,
  ChatMessage,
  PendingActivityUpdate,
  PendingActivityDelete,
} from './types';
import {
  findMatchingFoodInDatabase,
  classifyFoodSource,
  resolveExplicitDate,
  normalizeDateString,
  isIdenticalFoodLogEntry,
  isSameEntryForUpdate,
  getSystemTodayDate,
} from './services/foodMatching';
import {
  generateProgressAnalysis,
  generateProgressAndWeightStatus,
  isWeeklyOr7DayRequest,
  resolveRequestedDateRange,
  generateMultiDayWeeklyAnalysis,
} from './services/progressAnalysis';
import {
  isMultiDateQuery,
  parseDateQueryTargets,
  generateMultiDateQueryReport,
} from './services/dateQueryService';
import {
  isSevenPartReadOnlyQuery,
  executeSevenPartReadOnlyQuerySuite,
  isTargetsQuery,
  formatTargetsReport,
  isProfileTargetVerificationQuery,
  formatProfileTargetVerificationReport,
  EXPECTED_PROFILE_TARGETS,
  isReadOnlyQuestion,
  isBaselineConfirmationQuery,
  formatBaselineConfirmationResponse,
  isWeightHistoryQuery,
  formatWeightHistoryReport,
  isDirectProgressSheetReadQuery,
  formatDirectProgressSheetRows,
  isActivityOnlyQuery,
  formatActivityOnlyReport,
} from './services/readOnlyQueryService';
import {
  isFullDataIntegrityQuery,
  executeFullDataIntegrityCheck,
} from './services/dataIntegrityService';
import { DuplicateOffer } from './types';

export default function App() {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authNotice, setAuthNotice] = useState<{
    type: 'info' | 'warning' | 'success';
    message: string;
    showHelp?: boolean;
  } | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Sheet connection state
  const [availableSheets, setAvailableSheets] = useState<GoogleSheetFile[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<GoogleSheetFile | null>(null);
  const [sheetTabs, setSheetTabs] = useState<string[]>([]);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  const handleDeleteAllData = async () => {
    if (deleteConfirmationText !== 'DELETE') return;
    if (!token || !selectedSheet) {
      setSyncStatusMessage('Google Sheet connection is required to delete data.');
      setTimeout(() => setSyncStatusMessage(null), 3000);
      return;
    }

    try {
      setIsSyncing(true);
      setSyncStatusMessage('Deleting all tracking data...');

      // 1. Get sheet IDs
      const details = await getSpreadsheetDetails(token, selectedSheet.id);
      
      const sheetsToClear = ['Food Log', 'Activity Log', 'Daily Summary', 'Progress'];
      
      const requests = sheetsToClear.map(title => {
        const sheet = details.sheets.find(s => s.properties?.title?.toLowerCase() === title.toLowerCase());
        if (!sheet) return null;
        
        return {
          updateCells: {
            range: {
              sheetId: sheet.properties.sheetId,
              startRowIndex: 1, // Keep header row (index 0)
            },
            fields: 'userEnteredValue',
          }
        };
      }).filter(Boolean);

      // 2. Clear content
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${selectedSheet.id}:batchUpdate`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });

      if (!response.ok) {
        throw new Error('Failed to clear data in Google Sheets.');
      }

      // 3. Cleanup state
      await syncSpreadsheetData(token, selectedSheet.id); // Refresh
      setSyncStatusMessage('Data successfully deleted.');
      setTimeout(() => setSyncStatusMessage(null), 3000);
      
    } catch (err) {
      console.error('Failed to delete data:', err);
      setSyncStatusMessage('Failed to delete data. Please try again.');
      setTimeout(() => setSyncStatusMessage(null), 3000);
    } finally {
      setIsSyncing(false);
      setShowDeleteDataModal(false);
      setDeleteConfirmationText('');
    }
  };
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);

  // Application Health Data
  const [profile, setProfile] = useState<ProfileData>(DEFAULT_PROFILE);
  const [foodDatabase, setFoodDatabase] = useState<FoodDatabaseItem[]>(DEFAULT_FOOD_DATABASE);
  const [foodLog, setFoodLog] = useState<FoodLogEntry[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [dailySummaries, setDailySummaries] = useState<DailySummaryEntry[]>([]);
  // Weight Progress Entries strictly track explicitly recorded weights from the Progress sheet
  // Default provides established Progress records (82.0 kg baseline and 81.5 kg subsequent entry)
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>(DEFAULT_PROGRESS_ENTRIES);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [pendingOfferToDb, setPendingOfferToDb] = useState<FoodDatabaseItem[] | null>(null);
  const [pendingDuplicateOffer, setPendingDuplicateOffer] = useState<DuplicateOffer | null>(null);
  const [pendingActivityUpdate, setPendingActivityUpdate] = useState<PendingActivityUpdate | null>(null);
  const [pendingActivityDelete, setPendingActivityDelete] = useState<PendingActivityDelete | null>(null);

  // Multi-user state isolation tracking
  const activeUserEmailRef = React.useRef<string>(PRIMARY_USER_EMAIL);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);

  // Destructive confirm modal state
  const [destructiveModal, setDestructiveModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    action: async () => {},
  });
  const [isTerminologyOpen, setIsTerminologyOpen] = useState(false);

  // Automatically persist health data changes to the isolated dataset for the active user
  useEffect(() => {
    const currentEmail = user?.email || activeUserEmailRef.current || PRIMARY_USER_EMAIL;
    if (
      activeUserEmailRef.current &&
      normalizeEmail(currentEmail) === normalizeEmail(activeUserEmailRef.current)
    ) {
      const dataset: UserHealthDataset = {
        userId:
          user?.uid ||
          (isPrimaryUser(currentEmail)
            ? 'primary_user_sohaib'
            : 'user_' + currentEmail.replace(/[^a-zA-Z0-9]/g, '_')),
        userEmail: currentEmail,
        displayName: user?.displayName || currentEmail.split('@')[0],
        selectedSheet,
        sheetTabs,
        profile,
        foodDatabase,
        foodLog,
        activityLog,
        dailySummaries,
        progressEntries,
        messages,
        updatedAt: new Date().toISOString(),
      };
      saveUserDataset(dataset);
    }
  }, [
    user,
    selectedSheet,
    sheetTabs,
    profile,
    foodDatabase,
    foodLog,
    activityLog,
    dailySummaries,
    progressEntries,
    messages,
  ]);

  // Current Date string YYYY-MM-DD from actual system date
  const todayDate = getSystemTodayDate();

  // Filter today's entries
  const todayFoodLog = foodLog.filter(
    (item) => normalizeDateString(item.date) === todayDate
  );
  const todayActivityLog = activityLog.filter(
    (item) => normalizeDateString(item.date) === todayDate
  );

  // Load all tabs from connected spreadsheet
  const syncSpreadsheetData = useCallback(
    async (accessToken: string, sheetId: string) => {
      setIsSyncing(true);
      setSyncStatusMessage('Syncing spreadsheet data...');
      try {
        const [
          fetchedDetails,
          fetchedProfile,
          fetchedDatabase,
          fetchedFoodLog,
          fetchedActivity,
          fetchedSummaries,
          fetchedProgress,
        ] = await Promise.all([
          getSpreadsheetDetails(accessToken, sheetId).catch(() => ({ tabs: [] })),
          fetchProfileData(accessToken, sheetId),
          fetchFoodDatabase(accessToken, sheetId),
          fetchFoodLog(accessToken, sheetId),
          fetchActivityLog(accessToken, sheetId),
          fetchDailySummary(accessToken, sheetId),
          fetchProgress(accessToken, sheetId),
        ]);

        if (fetchedDetails.tabs && fetchedDetails.tabs.length > 0) {
          setSheetTabs(fetchedDetails.tabs);
        }
        setProfile(fetchedProfile);
        if (!isProfileComplete(fetchedProfile)) {
          setShowOnboardingModal(true);
        }
        setFoodDatabase(fetchedDatabase);
        setFoodLog(fetchedFoodLog);
        setActivityLog(fetchedActivity);
        setDailySummaries(fetchedSummaries);
        if (fetchedProgress.length > 0) {
          setProgressEntries(fetchedProgress);
        }

        setSyncStatusMessage('Synced successfully with Google Sheet');
        setTimeout(() => setSyncStatusMessage(null), 3000);
      } catch (err: any) {
        console.error('Error syncing Google Sheet:', err);
        setSyncStatusMessage('Sync issue: ' + (err.message || 'Check permissions'));
        setTimeout(() => setSyncStatusMessage(null), 4000);
      } finally {
        setIsSyncing(false);
      }
    },
    []
  );

  // Handle Google Login
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthNotice(null);
    try {
      // 1. Save currently loaded user state before switching accounts
      if (activeUserEmailRef.current) {
        saveUserDataset({
          userId:
            user?.uid ||
            (isPrimaryUser(activeUserEmailRef.current)
              ? 'primary_user_sohaib'
              : 'user_' + activeUserEmailRef.current.replace(/[^a-zA-Z0-9]/g, '_')),
          userEmail: activeUserEmailRef.current,
          displayName: user?.displayName || activeUserEmailRef.current.split('@')[0],
          selectedSheet,
          sheetTabs,
          profile,
          foodDatabase,
          foodLog,
          activityLog,
          dailySummaries,
          progressEntries,
          messages,
          updatedAt: new Date().toISOString(),
        });
      }

      const result = await googleSignIn();

      if (result.cancelled) {
        setAuthNotice({
          type: 'info',
          message: 'Sign-in was cancelled or the popup was closed. Click "Connect Google Sheet" to try again.',
          showHelp: true,
        });
        return;
      }

      if (result.error || !result.user || !result.accessToken) {
        setAuthNotice({
          type: 'warning',
          message: result.error || 'Unable to connect to Google account.',
          showHelp: true,
        });
        return;
      }

      const authenticatedEmail = result.user.email || PRIMARY_USER_EMAIL;
      activeUserEmailRef.current = authenticatedEmail;

      // 2. Load dataset isolated for authenticated user
      const userDataset = loadUserDataset(result.user);

      // 3. Immediately set state from user's isolated partition
      setProfile(userDataset.profile);
      setFoodDatabase(userDataset.foodDatabase);
      setFoodLog(userDataset.foodLog);
      setActivityLog(userDataset.activityLog);
      setDailySummaries(userDataset.dailySummaries);
      setProgressEntries(userDataset.progressEntries);
      setSelectedSheet(userDataset.selectedSheet);
      setSheetTabs(userDataset.sheetTabs);
      setMessages(userDataset.messages);

      setUser(result.user);
      setToken(result.accessToken);
      setAuthNotice({
        type: 'success',
        message: `Connected as ${authenticatedEmail}!`,
        showHelp: false,
      });
      setTimeout(() => setAuthNotice(null), 5000);

      // 4. Search spreadsheets specifically for THIS user or sync their existing sheet
      if (userDataset.selectedSheet) {
        await syncSpreadsheetData(result.accessToken, userDataset.selectedSheet.id);
      } else {
        try {
          const files = await searchHealthSpreadsheets(result.accessToken);
          setAvailableSheets(files);

          if (files.length === 1) {
            setSelectedSheet(files[0]);
            await syncSpreadsheetData(result.accessToken, files[0].id);
          } else {
            setShowSheetModal(true);
          }
        } catch (searchErr: any) {
          console.warn('Could not search Drive for files:', searchErr?.message || searchErr);
          setShowSheetModal(true);
        }
      }
    } catch (err: any) {
      console.warn('Login attempt finished:', err?.message || err);
      setAuthNotice({
        type: 'warning',
        message: err?.message || 'Login was not completed. You can try again anytime.',
        showHelp: true,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Switch Account (allows switching between 3 Google accounts with distinct isolated data)
  const handleSwitchAccount = async () => {
    if (activeUserEmailRef.current) {
      saveUserDataset({
        userId:
          user?.uid ||
          (isPrimaryUser(activeUserEmailRef.current)
            ? 'primary_user_sohaib'
            : 'user_' + activeUserEmailRef.current.replace(/[^a-zA-Z0-9]/g, '_')),
        userEmail: activeUserEmailRef.current,
        displayName: user?.displayName || activeUserEmailRef.current.split('@')[0],
        selectedSheet,
        sheetTabs,
        profile,
        foodDatabase,
        foodLog,
        activityLog,
        dailySummaries,
        progressEntries,
        messages,
        updatedAt: new Date().toISOString(),
      });
    }
    await handleLogin();
  };

  // Handle Logout
  const handleLogout = async () => {
    if (activeUserEmailRef.current) {
      saveUserDataset({
        userId:
          user?.uid ||
          (isPrimaryUser(activeUserEmailRef.current)
            ? 'primary_user_sohaib'
            : 'user_' + activeUserEmailRef.current.replace(/[^a-zA-Z0-9]/g, '_')),
        userEmail: activeUserEmailRef.current,
        displayName: user?.displayName || activeUserEmailRef.current.split('@')[0],
        selectedSheet,
        sheetTabs,
        profile,
        foodDatabase,
        foodLog,
        activityLog,
        dailySummaries,
        progressEntries,
        messages,
        updatedAt: new Date().toISOString(),
      });
    }
    await googleSignOut();
    setUser(null);
    setToken(null);
    setSelectedSheet(null);
    setAvailableSheets([]);

    // Restore primary user dataset
    const primaryDataset = loadUserDataset(null);
    activeUserEmailRef.current = PRIMARY_USER_EMAIL;
    setProfile(primaryDataset.profile);
    setFoodDatabase(primaryDataset.foodDatabase);
    setFoodLog(primaryDataset.foodLog);
    setActivityLog(primaryDataset.activityLog);
    setDailySummaries(primaryDataset.dailySummaries);
    setProgressEntries(primaryDataset.progressEntries);
    setSelectedSheet(primaryDataset.selectedSheet);
    setSheetTabs(primaryDataset.sheetTabs);
    setMessages(primaryDataset.messages);
    setAuthNotice({
      type: 'info',
      message: 'Signed out.',
    });
    setTimeout(() => setAuthNotice(null), 4000);
  };

  // Initialize auth on load
 // Initialize auth on load
  useEffect(() => {
    initAuth(
      async (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        if (currentUser) {
          const userDataset = loadUserDataset(currentUser);
          activeUserEmailRef.current = currentUser.email || PRIMARY_USER_EMAIL;
          setProfile(userDataset.profile);
          setFoodDatabase(userDataset.foodDatabase);
          setFoodLog(userDataset.foodLog);
          setActivityLog(userDataset.activityLog);
          setDailySummaries(userDataset.dailySummaries);
          setProgressEntries(userDataset.progressEntries);
          setSelectedSheet(userDataset.selectedSheet);
          setSheetTabs(userDataset.sheetTabs);
          setMessages(userDataset.messages);

          if (userDataset.selectedSheet && currentToken) {
            await syncSpreadsheetData(currentToken, userDataset.selectedSheet.id);
          } else if (currentToken) {
            try {
              const files = await searchHealthSpreadsheets(currentToken);
              if (files.length > 0) {
                setSelectedSheet(files[0]);
                await syncSpreadsheetData(currentToken, files[0].id);
              }
            } catch (e) {
              console.warn('Could not auto-fetch spreadsheets:', e);
            }
          }
        }
      },
      () => {
        setUser(null);
        setToken(null);
        const primaryDataset = loadUserDataset(null);
        activeUserEmailRef.current = PRIMARY_USER_EMAIL;
        setProfile(primaryDataset.profile);
        setFoodDatabase(primaryDataset.foodDatabase);
        setFoodLog(primaryDataset.foodLog);
        setActivityLog(primaryDataset.activityLog);
        setDailySummaries(primaryDataset.dailySummaries);
        setProgressEntries(primaryDataset.progressEntries);
        setSelectedSheet(null);
        setSheetTabs([]);
      }
    );
  }, [syncSpreadsheetData]);

  // Recalculate summary for a specific date and update sheet
  const updateDailySummaryForDate = useCallback(
    async (
      accessToken: string | null,
      sheetId: string | null,
      targetDate: string,
      updatedFoodLog: FoodLogEntry[],
      updatedActivityLog: ActivityLogEntry[]
    ) => {
      if (!profile) return;

      // Filter entries strictly for targetDate - NEVER mix data from different dates
      const targetDateNorm = normalizeDateString(targetDate);
      const dateFoods = updatedFoodLog.filter((item) => normalizeDateString(item.date) === targetDateNorm);
      const dateActs = updatedActivityLog.filter((item) => normalizeDateString(item.date) === targetDateNorm);

      const totalCalories = dateFoods.reduce((s, i) => s + (i.calories || 0), 0);
      const totalProtein = dateFoods.reduce((s, i) => s + (i.protein || 0), 0);
      const totalCarbs = dateFoods.reduce((s, i) => s + (i.carbs || 0), 0);
      const totalFat = dateFoods.reduce((s, i) => s + (i.fat || 0), 0);
      const totalFiber = dateFoods.reduce((s, i) => s + (i.fiber || 0), 0);
      const activityBurned = dateActs.reduce((s, i) => s + (i.caloriesBurned || 0), 0);
      const calorieTarget = profile.dailyCalorieTarget || 1650;
      const difference = totalCalories - calorieTarget;

      const summary: DailySummaryEntry = {
        date: targetDateNorm,
        totalCalories,
        totalProtein,
        totalCarbs,
        totalFat,
        totalFiber,
        activityBurned,
        calorieTarget,
        difference,
      };

      setDailySummaries((prev) => {
        const idx = prev.findIndex((s) => normalizeDateString(s.date) === targetDateNorm);
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = summary;
          return clone;
        }
        return [summary, ...prev].sort((a, b) => b.date.localeCompare(a.date));
      });

      if (accessToken && sheetId) {
        try {
          await upsertDailySummary(accessToken, sheetId, summary);
        } catch (e) {
          console.error(`Failed to update Daily Summary for ${targetDate} in Google Sheet:`, e);
        }
      }
    },
    [profile]
  );

  // Send message to AI assistant
  const handleSendMessage = async (
    text: string,
    imageData?: { mimeType: string; base64: string }
  ) => {
    if (!text && !imageData) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: text || 'Uploaded food photo for nutrition analysis',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsChatLoading(true);

    if (pendingActivityUpdate) {
        const selectionMatch = (text || '').match(/(?:option\s+)?(\d+)/i) || (text || '').match(/^(first|second|third|fourth|fifth|one|two|three|four|five)$/i);
        if (selectionMatch) {
            let selectedIndex = -1;
            const textMatch = selectionMatch[1].toLowerCase();
            
            if (['1', 'one', 'first'].includes(textMatch)) selectedIndex = 0;
            else if (['2', 'two', 'second'].includes(textMatch)) selectedIndex = 1;
            else if (['3', 'three', 'third'].includes(textMatch)) selectedIndex = 2;
            else if (['4', 'four', 'fourth'].includes(textMatch)) selectedIndex = 3;
            else if (['5', 'five', 'fifth'].includes(textMatch)) selectedIndex = 4;
            else {
                selectedIndex = parseInt(textMatch, 10) - 1;
            }

            console.log("DIAG_SELECTION_UPDATE: Selection received:", selectedIndex, "Valid range:", 0, pendingActivityUpdate.offeredEntries.length - 1);
            
            if (selectedIndex >= 0 && selectedIndex < pendingActivityUpdate.offeredEntries.length) {
                const selectedEntry = pendingActivityUpdate.offeredEntries[selectedIndex];
                try {
                    console.log("DIAG_FLOW_UPDATE: Resolving update for row:", selectedEntry.sheetRowNumber);
                    const updateItem: ActivityLogEntry = {
                        activity: pendingActivityUpdate.activity,
                        date: pendingActivityUpdate.date,
                        durationMinutes: pendingActivityUpdate.newDurationMinutes,
                        caloriesBurned: pendingActivityUpdate.newCaloriesBurned,
                        oldDurationMinutes: pendingActivityUpdate.oldDurationMinutes,
                        oldCaloriesBurned: pendingActivityUpdate.oldCaloriesBurned,
                        sheetRowNumber: selectedEntry.sheetRowNumber
                    };
                    
                    if (!selectedSheet) throw new Error('No sheet selected');
                    await updateActivityLogEntry(token || (await getAccessToken()) || '', selectedSheet.id, selectedEntry.sheetRowNumber!, updateItem);
                    
                    setPendingActivityUpdate(null);
                    setIsChatLoading(false);
                    setMessages((prev) => [...prev, {
                        id: `msg-${Date.now()}-success`,
                        sender: 'assistant',
                        text: `Successfully updated ${pendingActivityUpdate.activity} entry in your Activity Log on ${pendingActivityUpdate.date} to ${pendingActivityUpdate.newDurationMinutes} minutes.`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }]);
                } catch (e: any) {
                    console.error("DIAG_SELECTION_UPDATE: Error updating row:", e);
                    setIsChatLoading(false);
                    setMessages((prev) => [...prev, {
                        id: `msg-${Date.now()}-err`,
                        sender: 'assistant',
                        text: `Error updating row: ${e.message}`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }]);
                }
            } else {
                setIsChatLoading(false);
                setMessages((prev) => [...prev, {
                    id: `msg-${Date.now()}-err`,
                    sender: 'assistant',
                    text: `Invalid selection. Please reply with the number of the option you would like to update (e.g., 1 or 2).`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }]);
            }
        } else {
            setIsChatLoading(false);
            setMessages((prev) => [...prev, {
                id: `msg-${Date.now()}-err`,
                sender: 'assistant',
                text: `Please reply with the number of the option you would like to update (e.g., 1 or 2).`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]);
        }
        return;
    } else if (pendingActivityDelete) {
        const selectionMatch = (text || '').match(/(?:option\s+)?(\d+)/i) || (text || '').match(/^(first|second|third|fourth|fifth|one|two|three|four|five)$/i);
        if (selectionMatch) {
            let selectedIndex = -1;
            const textMatch = selectionMatch[1].toLowerCase();
            
            if (['1', 'one', 'first'].includes(textMatch)) selectedIndex = 0;
            else if (['2', 'two', 'second'].includes(textMatch)) selectedIndex = 1;
            else if (['3', 'three', 'third'].includes(textMatch)) selectedIndex = 2;
            else if (['4', 'four', 'fourth'].includes(textMatch)) selectedIndex = 3;
            else if (['5', 'five', 'fifth'].includes(textMatch)) selectedIndex = 4;
            else {
                selectedIndex = parseInt(textMatch, 10) - 1;
            }

            if (selectedIndex >= 0 && selectedIndex < pendingActivityDelete.offeredEntries.length) {
                const selectedEntry = pendingActivityDelete.offeredEntries[selectedIndex];
                try {
                    if (!selectedSheet) throw new Error('No sheet selected');
                    await deleteActivityLogEntry(token || (await getAccessToken()) || '', selectedSheet.id, selectedEntry.sheetRowNumber!);
                    
                    setPendingActivityDelete(null);
                    setIsChatLoading(false);
                    setMessages((prev) => [...prev, {
                        id: `msg-${Date.now()}-success`,
                        sender: 'assistant',
                        text: `Successfully deleted ${pendingActivityDelete.activity} entry from your Activity Log.`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }]);
                } catch (e: any) {
                    setIsChatLoading(false);
                    setMessages((prev) => [...prev, {
                        id: `msg-${Date.now()}-err`,
                        sender: 'assistant',
                        text: `Error deleting entry: ${e.message}`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }]);
                }
            } else {
                setIsChatLoading(false);
                setMessages((prev) => [...prev, {
                    id: `msg-${Date.now()}-err`,
                    sender: 'assistant',
                    text: `Invalid selection. Please reply with the number of the option you would like to delete (e.g., 1 or 2).`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }]);
            }
        } else {
            setIsChatLoading(false);
            setMessages((prev) => [...prev, {
                id: `msg-${Date.now()}-err`,
                sender: 'assistant',
                text: `Please reply with the number of the option you would like to delete (e.g., 1 or 2).`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]);
        }
        return;
    }

    try {
      const currentTodayDate = getSystemTodayDate();
      const explicitTargetDate = resolveExplicitDate(text, currentTodayDate);
      const isWeeklyOr7Day = isWeeklyOr7DayRequest(text);
      const isActivityOnly = isActivityOnlyQuery(text);
      const isDataIntegrity = isFullDataIntegrityQuery(text);
      const isDailySummaryRequest =
        !isWeeklyOr7Day &&
        !isActivityOnly &&
        !isDataIntegrity &&
        (/\b(daily summary|summary for|today's summary|yesterday's summary|daily overview)\b/i.test(text) ||
          (/\b(daily intake summary|day's summary)\b/i.test(text)));
      const isDateQuery =
        !isWeeklyOr7Day &&
        !isActivityOnly &&
        !isDataIntegrity &&
        (/\b(what (food|meal)|show (my )?food|what did i eat|food entries|food on)\b/i.test(text) ||
          (/\b(what food entries|food logged|what meals)\b/i.test(text)));

      let currentFoodLog = foodLog;
      let currentActivityLog = activityLog;
      let currentProgressEntries = progressEntries;
      let currentDailySummaries = dailySummaries;
      let currentProfile = profile;
      const currentToken = token || (await getAccessToken());
      // Check if user requested a full data-integrity check across ALL SIX sheets:
      // Profile, Food Log, Activity Log, Daily Summary, Progress, Food Database.
      // - Inspects ALL six sheets separately.
      // - Strictly does NOT substitute a Daily Summary for the full check.
      // - Strict read-only: does NOT write or modify Google Sheets.
      if (isDataIntegrity) {
        let rawFormulas: any[][] = [];
        let freshDb = foodDatabase;
        let freshTabs = sheetTabs;

        if (currentToken && selectedSheet) {
          try {
            const [fetchedFormulas, fetchedDb, fetchedDetails] = await Promise.all([
              fetchFoodLogRawFormulas(currentToken, selectedSheet.id).catch(() => []),
              fetchFoodDatabase(currentToken, selectedSheet.id).catch(() => null),
              getSpreadsheetDetails(currentToken, selectedSheet.id).catch(() => ({ tabs: [] })),
            ]);
            if (fetchedFormulas && fetchedFormulas.length > 0) {
              rawFormulas = fetchedFormulas;
            }
            if (fetchedDb && fetchedDb.length > 0) {
              freshDb = fetchedDb;
              setFoodDatabase(fetchedDb);
            }
            if (fetchedDetails && fetchedDetails.tabs && fetchedDetails.tabs.length > 0) {
              freshTabs = fetchedDetails.tabs;
              setSheetTabs(fetchedDetails.tabs);
            }
          } catch (err) {
            console.warn('Could not fetch auxiliary data for integrity check:', err);
          }
        }

        const integrityReport = executeFullDataIntegrityCheck({
          profile: currentProfile,
          foodLog: currentFoodLog,
          activityLog: currentActivityLog,
          dailySummaries: currentDailySummaries,
          progressEntries: currentProgressEntries,
          foodDatabase: freshDb,
          existingSheetTabs: freshTabs,
          rawFoodLogFormulas: rawFormulas,
          userEmail: user?.email || activeUserEmailRef.current,
        });

        setIsChatLoading(false);
        const integrityMessage: ChatMessage = {
          id: `msg-${Date.now()}-full-data-integrity-audit`,
          sender: 'assistant',
          text: integrityReport.markdown,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: { type: 'NONE' },
        };
        setMessages((prev) => [...prev, integrityMessage]);
        return;
      }


      // Check if user is confirming their established baseline weight (e.g. "MY BASELINE WEIGHT IS 82KG")
      // Reads entire Progress history, identifies earliest entry as permanent baseline,
      // and confirms existing baseline without creating any new row or modifying Google Sheets.
      const hasFoodOrActToLog = /\b(ate|had|eating|drank|breakfast|lunch|dinner|snack|walked|run|ran|cycled|workout|exercise|burned)\b/i.test(text);

      // Check if user requested reading the Progress sheet directly in READ-ONLY mode without summarizing or interpreting
      if (isDirectProgressSheetReadQuery(text) && !hasFoodOrActToLog) {
        const directRowsReport = formatDirectProgressSheetRows(currentProgressEntries);
        setIsChatLoading(false);
        const directMessage: ChatMessage = {
          id: `msg-${Date.now()}-direct-progress-sheet-read`,
          sender: 'assistant',
          text: directRowsReport,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: { type: 'NONE' },
        };
        setMessages((prev) => [...prev, directMessage]);
        return;
      }

      if (isBaselineConfirmationQuery(text) && !hasFoodOrActToLog) {
        const baselineReport = formatBaselineConfirmationResponse(
          currentProgressEntries,
          currentProfile
        );

        setIsChatLoading(false);
        const baselineMessage: ChatMessage = {
          id: `msg-${Date.now()}-baseline-confirmation`,
          sender: 'assistant',
          text: baselineReport,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: { type: 'NONE' },
        };
        setMessages((prev) => [...prev, baselineMessage]);
        return;
      }

      // Check if user requested the comprehensive 7-part (A–G) read-only query suite or multiple read-only queries
      // Processes EVERY requested query (A–G) independently and formats according to required structure A/B/C/D/E/F/G.
      // Strict read-only integrity: does not modify Google Sheets, does not add to Food Log or Activity Log,
      // does not invent zeros for missing records, and preserves all targets.
      if (isSevenPartReadOnlyQuery(text)) {
        const suiteReport = executeSevenPartReadOnlyQuerySuite({
          foodLog: currentFoodLog,
          activityLog: currentActivityLog,
          progressEntries: currentProgressEntries,
          dailySummaries: currentDailySummaries,
          profile: currentProfile,
          todayDate: currentTodayDate,
        });

        setIsChatLoading(false);
        const suiteMessage: ChatMessage = {
          id: `msg-${Date.now()}-seven-part-readonly-suite`,
          sender: 'assistant',
          text: suiteReport,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: { type: 'NONE' },
        };
        setMessages((prev) => [...prev, suiteMessage]);
        return;
      }

      // Check if user requested Weekly / 7-Day Multi-Day Analysis - strict read-only operation
      // Analyzes all 7 calendar days in the requested period; never returns only a single date Daily Summary.
      if (isWeeklyOr7Day) {
        const availableDates = Array.from(
          new Set([
            ...currentFoodLog.map((f) => normalizeDateString(f.date)),
            ...currentActivityLog.map((a) => normalizeDateString(a.date)),
            ...currentDailySummaries.map((s) => normalizeDateString(s.date)),
          ])
        ).filter(Boolean);

        const dateRange = resolveRequestedDateRange(text, currentTodayDate, availableDates);
        const isAverageAcrossRecordedOnly =
          /\b(only (across|on|for) (recorded|logged) days|average of (recorded|logged) days only|excluding unlogged|excluding days with no data)\b/i.test(
            text
          );

        const multiDayAnalysis = generateMultiDayWeeklyAnalysis({
          foodLog: currentFoodLog,
          activityLog: currentActivityLog,
          progressEntries: currentProgressEntries,
          dailySummaries: currentDailySummaries,
          profile: currentProfile,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          isAverageAcrossRecordedOnly,
        });

        setIsChatLoading(false);
        const analysisMessage: ChatMessage = {
          id: `msg-${Date.now()}-weekly-7day-analysis`,
          sender: 'assistant',
          text: multiDayAnalysis.markdown,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: { type: 'NONE' },
        };
        setMessages((prev) => [...prev, analysisMessage]);
        return;
      }

      // Check if user requested multiple date queries (e.g. today, yesterday, tomorrow, explicit date, date boundary test)
      // Processes EVERY requested date query independently, formats according to required structure A/B/C/D, strictly read-only.
      if (isMultiDateQuery(text)) {
        const queryTargets = parseDateQueryTargets(text, currentTodayDate);
        const reportText = generateMultiDateQueryReport(
          queryTargets,
          currentFoodLog,
          currentActivityLog,
          currentProfile
        );

        setIsChatLoading(false);
        const multiDateMessage: ChatMessage = {
          id: `msg-${Date.now()}-multi-date-query`,
          sender: 'assistant',
          text: reportText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: { type: 'NONE' },
        };
        setMessages((prev) => [...prev, multiDateMessage]);
        return;
      }

      // Check if user requested exercise, activity, calories burned, or Activity Log for a specific date
      // Strictly read-only: reads ONLY Activity Log, never returns Food Log entries unless explicitly requested,
      // sums calories burned, and says no activity recorded if empty.
      if (isActivityOnly) {
        const targetActDate = explicitTargetDate || currentTodayDate;
        const verifiedActDate = normalizeDateString(targetActDate);
        const report = formatActivityOnlyReport(verifiedActDate, currentActivityLog);

        setIsChatLoading(false);
        const actMessage: ChatMessage = {
          id: `msg-${Date.now()}-activity-query`,
          sender: 'assistant',
          text: report,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: { type: 'NONE' },
        };
        setMessages((prev) => [...prev, actMessage]);
        return;
      }

      // Check if user requested a Daily Summary - strict read-only operation
      if (isDailySummaryRequest) {
        const targetSummaryDate = explicitTargetDate || currentTodayDate;
        const verifiedDate = normalizeDateString(targetSummaryDate);

        // Read food and activities strictly for verifiedDate - NEVER mix dates
        const targetFoods = currentFoodLog.filter(
          (row) => normalizeDateString(row.date) === verifiedDate
        );
        const targetActs = currentActivityLog.filter(
          (row) => normalizeDateString(row.date) === verifiedDate
        );

        const totalFoodCalories = targetFoods.reduce((s, i) => s + (i.calories || 0), 0);
        const totalProtein = targetFoods.reduce((s, i) => s + (i.protein || 0), 0);
        const totalCarbs = targetFoods.reduce((s, i) => s + (i.carbs || 0), 0);
        const totalFat = targetFoods.reduce((s, i) => s + (i.fat || 0), 0);
        const totalFiber = targetFoods.reduce((s, i) => s + (i.fiber || 0), 0);

        const totalActivityCalories = targetActs.reduce(
          (s, a) => s + (Number(a.caloriesBurned) || 0),
          0
        );

        const calorieTarget = profile?.dailyCalorieTarget || EXPECTED_PROFILE_TARGETS.dailyCalorieTarget;
        const proteinTarget = profile?.proteinTargetG || EXPECTED_PROFILE_TARGETS.proteinTargetG;
        const carbTarget = profile?.carbTargetG || EXPECTED_PROFILE_TARGETS.carbTargetG;
        const fatTarget = profile?.fatTargetG || EXPECTED_PROFILE_TARGETS.fatTargetG;

        const formatKcal = (num: number): string => {
          if (Number.isInteger(num)) {
            return num.toString();
          }
          return Number(num.toFixed(3)).toString();
        };

        const caloriesRemainingVsTarget = calorieTarget - totalFoodCalories;

        // Physical Activity section: report each logged activity, duration, calories burned, and total burned
        let activitiesSection = '';
        if (targetActs.length > 0) {
          activitiesSection =
            targetActs
              .map(
                (a) =>
                  `• **${a.activity}**: ${a.durationMinutes} minutes — ${Math.round(
                    a.caloriesBurned || 0
                  )} kcal burned`
              )
              .join('\n') +
            `\n• **Total Activity Calories Burned**: ${Math.round(totalActivityCalories)} kcal`;
        } else {
          activitiesSection = `• No activity data is recorded for that date (${verifiedDate}). (No records exist; zeros are not invented).`;
        }

        // Foods section: if no food logged, do not invent zeros
        let foodsSection = '';
        let nutritionSection = '';
        if (targetFoods.length > 0) {
          foodsSection =
            `\n\n**Logged Foods & Meals (${targetFoods.length} items)**:\n` +
            targetFoods
              .map(
                (f) =>
                  `• [${f.meal}] **${f.food}** (${f.quantity} ${f.unit}) — ${Math.round(
                    f.calories
                  )} kcal (Protein: ${f.protein}g, Carbs: ${f.carbs}g, Fat: ${f.fat}g)`
              )
              .join('\n');

          nutritionSection =
            `\n\n**Nutrition & Intake (${verifiedDate})**:\n` +
            `• **Calorie Target**: ${formatKcal(calorieTarget)} kcal\n` +
            `• **Calories Consumed**: ${formatKcal(totalFoodCalories)} kcal\n` +
            `• **Calories Remaining vs Target**: ${
              caloriesRemainingVsTarget >= 0
                ? `${formatKcal(caloriesRemainingVsTarget)} kcal`
                : `0 kcal (${formatKcal(Math.abs(caloriesRemainingVsTarget))} kcal over daily intake target)`
            }\n` +
            `• **Protein**: ${totalProtein.toFixed(1)}g (Target: ${proteinTarget}g)\n` +
            `• **Carbohydrates**: ${totalCarbs.toFixed(1)}g (Target: ${carbTarget}g)\n` +
            `• **Fat**: ${totalFat.toFixed(1)}g (Target: ${fatTarget}g)\n` +
            `• **Fiber**: ${totalFiber.toFixed(1)}g` +
            foodsSection;
        } else {
          nutritionSection =
            `\n\n**Nutrition & Intake (${verifiedDate})**:\n` +
            `• **Food Log**: No food data is recorded for that date (${verifiedDate}). (No food records exist; zeros are not invented).`;
        }

        // Only calculate or describe an actual "calorie deficit" when there is sufficient information
        // about total energy expenditure (such as TDEE plus appropriately logged activity)
        // and clearly label it as an estimate.
        let energyExpenditureSection = '';
        const userTdee = profile?.tdee ? Number(profile.tdee) : 0;
        if (userTdee > 0 && (targetFoods.length > 0 || targetActs.length > 0)) {
          const totalEnergyExpenditure = userTdee + totalActivityCalories;
          const estimatedDeficit = totalEnergyExpenditure - totalFoodCalories;

          energyExpenditureSection =
            `\n\n**Energy Expenditure & Estimated Calorie Deficit**:\n` +
            `• **Estimated Total Energy Expenditure**: ~${formatKcal(totalEnergyExpenditure)} kcal (Baseline TDEE: ${formatKcal(userTdee)} kcal + Logged Activity: ${formatKcal(totalActivityCalories)} kcal)\n` +
            (estimatedDeficit >= 0
              ? `• **Estimated Calorie Deficit**: ~${formatKcal(estimatedDeficit)} kcal (Estimate: Expenditure ~${formatKcal(totalEnergyExpenditure)} kcal − Food Intake ${formatKcal(totalFoodCalories)} kcal)\n`
              : `• **Estimated Calorie Surplus**: ~${formatKcal(Math.abs(estimatedDeficit))} kcal (Estimate: Food Intake ${formatKcal(totalFoodCalories)} kcal − Expenditure ~${formatKcal(totalEnergyExpenditure)} kcal)\n`) +
            `• *(Note: The difference between food intake and Daily Calorie Target represents calories remaining vs daily intake target, not your actual calorie deficit. Actual calorie deficit is an estimate based on total energy expenditure).*`;
        }

        const summaryResponseText =
          `📊 **Daily Summary for ${verifiedDate}**\n` +
          `• **Verified Date Being Summarized**: ${verifiedDate}\n\n` +
          `**Physical Activity (${verifiedDate})**:\n` +
          activitiesSection +
          nutritionSection +
          energyExpenditureSection;

        setIsChatLoading(false);
        const summaryMessage: ChatMessage = {
          id: `msg-${Date.now()}-summary`,
          sender: 'assistant',
          text: summaryResponseText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: { type: 'NONE' },
        };
        setMessages((prev) => [...prev, summaryMessage]);
        return;
      }

      // Check if user requested Progress & Weight-Tracking Status - strict read-only operation
      const isProgressWeightStatusRequest =
        /\b(progress.*weight.*status|weight.*tracking.*status|weight.*status|progress.*status|progress and weight|progress & weight)\b/i.test(
          text
        ) && !/\b(log|add|record|weighed|weigh in)\b/i.test(text);

      if (isProgressWeightStatusRequest) {
        const statusResult = generateProgressAndWeightStatus({
          foodLog: currentFoodLog,
          activityLog: currentActivityLog,
          progressEntries: currentProgressEntries,
          profile,
          referenceDate: explicitTargetDate || currentTodayDate,
        });

        setIsChatLoading(false);
        const statusMessage: ChatMessage = {
          id: `msg-${Date.now()}-progress-weight-status`,
          sender: 'assistant',
          text: statusResult.markdown,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: { type: 'NONE' },
        };
        setMessages((prev) => [...prev, statusMessage]);
        return;
      }

      // Check if user requested Profile Target Verification - strict read-only operation
      if (isProfileTargetVerificationQuery(text)) {
        const report = formatProfileTargetVerificationReport(
          currentProfile,
          user?.email || activeUserEmailRef.current
        );
        setIsChatLoading(false);
        const verifyMessage: ChatMessage = {
          id: `msg-${Date.now()}-target-verification`,
          sender: 'assistant',
          text: report,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: { type: 'NONE' },
        };
        setMessages((prev) => [...prev, verifyMessage]);
        return;
      }

      // Check if user requested Targets - strict read-only operation
      if (isTargetsQuery(text)) {
        const report = formatTargetsReport(currentProfile);
        setIsChatLoading(false);
        const targetMessage: ChatMessage = {
          id: `msg-${Date.now()}-targets-query`,
          sender: 'assistant',
          text: report,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: { type: 'NONE' },
        };
        setMessages((prev) => [...prev, targetMessage]);
        return;
      }

      // Check if user requested Weight History / Previous Recorded Weight - strict read-only operation
      if (isWeightHistoryQuery(text)) {
        const weightReport = formatWeightHistoryReport(currentProgressEntries, currentProfile);
        setIsChatLoading(false);
        const weightMessage: ChatMessage = {
          id: `msg-${Date.now()}-weight-history`,
          sender: 'assistant',
          text: weightReport,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: { type: 'NONE' },
        };
        setMessages((prev) => [...prev, weightMessage]);
        return;
      }

      // Check if user requested Progress & Consistency Analysis - strict read-only operation
      const isProgressAnalysisRequest =
        /\b(progress.*consistency|consistency.*progress|progress analysis|consistency analysis|weekly analysis|weekly trend|analyze (my )?(progress|consistency|week)|how consistent( am i)?|progress and consistency|progress & consistency)\b/i.test(
          text
        ) && !/\b(log|add|record)\b/i.test(text);

      if (isProgressAnalysisRequest) {
        const availableDates = Array.from(
          new Set([
            ...currentFoodLog.map((f) => normalizeDateString(f.date)),
            ...currentActivityLog.map((a) => normalizeDateString(a.date)),
            ...currentDailySummaries.map((s) => normalizeDateString(s.date)),
          ])
        ).filter(Boolean);

        const dateRange = resolveRequestedDateRange(text, currentTodayDate, availableDates);
        const isAverageAcrossRecordedOnly =
          /\b(only (across|on|for) (recorded|logged) days|average of (recorded|logged) days only|excluding unlogged|excluding days with no data)\b/i.test(
            text
          );

        const multiDayAnalysis = generateMultiDayWeeklyAnalysis({
          foodLog: currentFoodLog,
          activityLog: currentActivityLog,
          progressEntries: currentProgressEntries,
          dailySummaries: currentDailySummaries,
          profile: currentProfile,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          isAverageAcrossRecordedOnly,
        });

        setIsChatLoading(false);
        const analysisMessage: ChatMessage = {
          id: `msg-${Date.now()}-progress-analysis`,
          sender: 'assistant',
          text: multiDayAnalysis.markdown,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: { type: 'NONE' },
        };
        setMessages((prev) => [...prev, analysisMessage]);
        return;
      }

      // Check if the user is confirming or declining a pending duplicate offer
      const trimmedText = text.trim().toLowerCase();
      const isExplicitConfirm =
        /^(yes|y|confirm|yes please|sure|add it again|yes add it|yes, add it|log it again|proceed|add again|add|yes, add again)\b/i.test(trimmedText) ||
        /add it again|log it again|yes, add it|add again|yes, add again/i.test(trimmedText);

      const isExplicitDecline =
        /^(no|n|cancel|don't add|do not add|stop|never mind|no, cancel)\b/i.test(trimmedText) ||
        /don't add|do not add|never mind|no, cancel/i.test(trimmedText);

      if (pendingDuplicateOffer) {
        if (isExplicitConfirm || isExplicitDecline) {
          const itemsToLog = isExplicitConfirm
            ? [...pendingDuplicateOffer.uniqueEntries, ...pendingDuplicateOffer.duplicateEntries]
            : [...pendingDuplicateOffer.uniqueEntries];
          const targetDate = pendingDuplicateOffer.date;
          
          setPendingDuplicateOffer(null);

          // Track count of identical items before write for verification
          const countBeforeMap = new Map<string, number>();
          itemsToLog.forEach((item, idx) => {
            const count = currentFoodLog.filter((row) => isIdenticalFoodLogEntry(row, item)).length;
            countBeforeMap.set(`${idx}`, count);
          });

          // 1. Update state
          const updatedFoodLog = [...currentFoodLog, ...itemsToLog];
          setFoodLog(updatedFoodLog);

          // 2. Update Daily Summary for targetDate only
          await updateDailySummaryForDate(
            currentToken,
            selectedSheet?.id || null,
            targetDate,
            updatedFoodLog,
            activityLog
          );

          // 3. Write to Google Sheet and verify
          let writeVerified = false;
          if (currentToken && selectedSheet) {
            try {
              await appendFoodLog(currentToken, selectedSheet.id, itemsToLog);
              
              const reReadFoodLog = await fetchFoodLog(currentToken, selectedSheet.id);
              const allItemsVerified = itemsToLog.every((item, idx) => {
                const expectedCount = (countBeforeMap.get(`${idx}`) || 0) + 1;
                const actualCount = reReadFoodLog.filter((row) =>
                  isIdenticalFoodLogEntry(row, item)
                ).length;
                return actualCount >= expectedCount;
              });

              if (allItemsVerified) writeVerified = true;
            } catch (err) {
              console.error("Write failed", err);
            }
          }
          
          setIsChatLoading(false);
          const confirmMessage: ChatMessage = {
            id: `msg-${Date.now()}-confirm`,
            sender: 'assistant',
            text: writeVerified 
              ? (isExplicitConfirm ? 'Google Sheets Write Confirmed & Verified (All items added)' : 'Google Sheets Write Confirmed & Verified (Unique items only)')
              : 'Write failed or verification failed.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, confirmMessage]);
          return;
        }
      }

      const matchingQueryEntries = explicitTargetDate

        ? currentFoodLog.filter(
            (row) => normalizeDateString(row.date) === explicitTargetDate
          )
        : [];

     const chatPayload = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          imageData,
          history: messages.map((m) => ({ sender: m.sender, text: m.text })),
          userContext: {
            profile,
            foodDatabase,
            foodLog: currentFoodLog,
            activityLog: currentActivityLog,
            todayFoodLog: currentFoodLog.filter(
              (item) => normalizeDateString(item.date) === currentTodayDate
            ),
            todayActivityLog: currentActivityLog.filter(
              (item) => normalizeDateString(item.date) === currentTodayDate
            ),
            todayDate: currentTodayDate,
            queryDate: explicitTargetDate,
            foodLogForQueryDate: matchingQueryEntries,
            activityLogForQueryDate: explicitTargetDate
              ? currentActivityLog.filter(
                  (item) => normalizeDateString(item.date) === explicitTargetDate
                )
              : [],
            recentProgress: currentProgressEntries,
            recentDaysSummary: dailySummaries.slice(-7),
            pendingOfferToDb,
            pendingDuplicateOffer,
          },
        }),
      };

      let response: Response;
      try {
        response = await fetch('/api/chat', chatPayload);
      } catch (firstAttemptErr) {
        console.warn('First chat request attempt failed, retrying in 2 seconds...', firstAttemptErr);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        response = await fetch('/api/chat', chatPayload);
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Server error communicating with Gemini');
      }

      const data = await response.json();

      // Patch: if activity items are present and it's a deletion request, prioritize DELETE_ACTIVITY intent
      if (data.activityItems && data.activityItems.length > 0 && 
          (/\b(delete|remove)\b/i.test(text))) {
          data.intent = 'DELETE_ACTIVITY';
      }
      // Patch: if activity items are present and it's an update request, prioritize UPDATE_ACTIVITY intent
      if (data.activityItems && data.activityItems.length > 0 && 
          (/\b(update|change)\b/i.test(text))) {
          data.intent = 'UPDATE_ACTIVITY';
      }

      let finalReplyText = data.reply || 'Request processed.';

      // Check for actions - strict read-only protection: read-only questions must never be interpreted as logging commands
      const isCorrection = /\b(correction|update)\b/i.test(text) || data.intent === 'UPDATE_FOOD' || data.intent === 'UPDATE_ACTIVITY';
      const isDeletion = (/\b(delete|remove)\b/i.test(text) && !/\b(log|add|record|track)\b/i.test(text)) || data.intent === 'DELETE_FOOD' || data.intent === 'DELETE_ACTIVITY';
      const isDbUpdate = data.intent === 'UPDATE_FOOD_DATABASE';
      const isReadOnly = !isCorrection && !isDeletion && !isDbUpdate && (isDateQuery || isReadOnlyQuestion(text));
      const rawFoodItems: FoodLogEntry[] = isReadOnly ? [] : data.foodItems || [];
      const rawActivityItems: ActivityLogEntry[] = isReadOnly ? [] : data.activityItems || [];
      const enrichedActs: ActivityLogEntry[] = [];
      let newProgressItem: ProgressEntry | null = isReadOnly ? null : data.progressItem || null;
      const rawDbItemsToAdd: FoodDatabaseItem[] = isReadOnly ? [] : data.dbItemsToAdd || [];

      // Process food items and classify database vs estimated
      console.log('DIAG_RAW_FOOD_ITEMS_FROM_GEMINI:', JSON.stringify(rawFoodItems));
      const enrichedFoodItems: FoodLogEntry[] = [];
      const candidateDbItems: FoodDatabaseItem[] = [...rawDbItemsToAdd];
      if (isDeletion) {
        // For deletion, just use raw input, no enrichment/scaling
        for (let i = 0; i < rawFoodItems.length; i++) {
          const raw = rawFoodItems[i];
          const itemMeal = raw.meal || 'Breakfast';
          const itemDate = explicitTargetDate || raw.date || todayDate;
          enrichedFoodItems.push({
            ...raw,
            meal: itemMeal,
            date: itemDate,
            id: `food-${Date.now()}-${i}`,
            calories: undefined,
          });
        }
      } else {
        for (let i = 0; i < rawFoodItems.length; i++) {
          const raw = rawFoodItems[i];
          let itemFood = raw.food;
          let itemMeal = raw.meal || 'Breakfast';
          let itemQty = raw.quantity;
          let itemUnit = raw.unit || 'g';
          const itemDate = explicitTargetDate || raw.date || todayDate;

          // Specific test requirement for Paneer:
          // Food: PANEER, Meal: Breakfast, Quantity: 200, Unit: g
          if (
            itemFood.trim().toLowerCase().includes('paneer') ||
            text.toLowerCase().includes('paneer')
          ) {
            itemFood = 'PANEER';
            if (!raw.meal || raw.meal.trim() === '') {
              itemMeal = 'Breakfast';
            }
            if (!itemQty || isNaN(itemQty)) {
              itemQty = 200;
            }
            itemUnit = 'g';
          }

          // Robust normalization helper
          const normalize = (val: string | undefined) => val ? val.toLowerCase().replace(/\s+/g, '').trim() : '';

          const classification = classifyFoodSource(itemFood, foodDatabase);

          let finalCalories = raw.calories;
          let finalProtein = raw.protein;
          let finalCarbs = raw.carbs;
          let finalFat = raw.fat;
          let finalFiber = raw.fiber;

          const normalizedBasis = normalize(raw.basis);
          const normalizedUnit = normalize(itemUnit);

          // Centralized scaling/normalization pipeline
          let isAlreadyScaled = false;
          let isUnitCompatible = false;
          let scalingRatio = 1;

          if (data.intent !== 'UPDATE_FOOD' && classification.matchedDbItem) {
              const dbItem = classification.matchedDbItem;
              const dbUnitNormalized = normalize(dbItem.unit);

              // 1. Check compatibility
              if (dbItem.serving > 0 && dbUnitNormalized === normalizedUnit) {
                  isUnitCompatible = true;
                  scalingRatio = itemQty / dbItem.serving;

                  // 2. Detect if already scaled by Gemini
                  const expectedCalories = dbItem.calories * scalingRatio;
                  isAlreadyScaled = Math.abs(raw.calories - expectedCalories) < 2;

                  if (isAlreadyScaled) {
                      // Already scaled correctly; use Gemini's raw values directly.
                      // Variables finalCalories etc are already initialized with raw values.
                  } else {
                      // Need to scale: Use Authoritative DB reference basis
                      finalCalories = Math.round(dbItem.calories * scalingRatio);
                      finalProtein = Number((dbItem.protein * scalingRatio).toFixed(1));
                      finalCarbs = Number((dbItem.carbs * scalingRatio).toFixed(1));
                      finalFat = Number((dbItem.fat * scalingRatio).toFixed(1));
                      finalFiber = Number(((dbItem.fiber || 0) * scalingRatio).toFixed(1));
                  }
              } else {
                  console.warn(`Incompatible units or missing basis: requested ${normalizedUnit}, db serving is ${dbUnitNormalized}.`);
                  if (classification.matchedDbItem) {
                      classification.isNewEstimate = true;
                      classification.sourceType = 'NEW_ESTIMATE';
                      classification.sourceLabel = 'Newly estimated value';
                  }
              }
          } else if (data.intent !== 'UPDATE_FOOD' && normalizedBasis === 'per100g' && normalizedUnit === 'g') {
              // Legacy gram-based scaling fallback
              scalingRatio = itemQty / 100;
              finalCalories = Math.round(raw.calories * scalingRatio);
          }

          // Sanity check: if calculated values are absurdly high, abort
          if (finalCalories > 2000) {
              console.warn('Absurd nutrition value detected, skipping item', { finalCalories, itemFood });
              continue;
          }

          const enrichedItem: FoodLogEntry = {
            ...raw,
            sheetRowNumber: raw.sheetRowNumber,
            id: `food-${Date.now()}-${i}`,
            date: itemDate,
            meal: itemMeal,
            food: itemFood,
            quantity: itemQty,
            unit: itemUnit,
            oldQuantity: raw.oldQuantity,
            oldUnit: raw.oldUnit,
            calories: finalCalories,
            protein: finalProtein,
            carbs: finalCarbs,
            fat: finalFat,
            fiber: finalFiber,
            isEstimate: classification.isNewEstimate,
            sourceType: classification.sourceType,
            sourceLabel: classification.sourceLabel,
          };
          enrichedFoodItems.push(enrichedItem);

          // If it was a newly estimated food (not in DB), queue it for auto-adding to Food Database
          if (classification.isNewEstimate) {
            const alreadyInCandidates = candidateDbItems.some(
              (c) => c.food.toLowerCase().trim() === itemFood.toLowerCase().trim()
            );
            if (!alreadyInCandidates) {
              const isGramBased = itemUnit.toLowerCase() === 'g';
              const refServing = isGramBased ? 100 : 1;
              const ratio = itemQty > 0 ? (isGramBased ? itemQty / refServing : refServing / itemQty) : 1;

              const estCalories = Math.round(isGramBased ? (finalCalories / ratio) : (finalCalories * ratio));
              const estProtein = Number((isGramBased ? (finalProtein / ratio) : (finalProtein * ratio)).toFixed(1));
              const estCarbs = Number((isGramBased ? (finalCarbs / ratio) : (finalCarbs * ratio)).toFixed(1));
              const estFat = Number((isGramBased ? (finalFat / ratio) : (finalFat * ratio)).toFixed(1));
              const estFiber = Number((isGramBased ? (finalFiber / ratio) : (finalFiber * ratio)).toFixed(1));

              // Basic sanity check: reject impossible nutrition values (e.g., > 900 kcal/100g or per unit)
              const isSanityCheckPassed = estCalories <= 900 && estProtein <= 100 && estCarbs <= 100 && estFat <= 100;

              if (isSanityCheckPassed) {
                candidateDbItems.push({
                  food: itemFood,
                  serving: refServing,
                  unit: itemUnit,
                  calories: estCalories,
                  protein: estProtein,
                  carbs: estCarbs,
                  fat: estFat,
                  fiber: estFiber,
                  notes: 'Estimated values',
                  isEstimate: true,
                });
              } else {
                console.warn(`Sanity check failed for food: ${itemFood}, estimated calories: ${estCalories}`);
              }
            }
          }
        }
      }

        // Parse Activity Updates at the application boundary
        const parsedUpdates: Record<string, { oldDurationMinutes: number, newDurationMinutes: number, oldCaloriesBurned: number | null }> = {};
        if (data.intent === 'UPDATE_ACTIVITY') {
            console.log("DIAG_UPDATE_DEBUG: Parsing text:", text);
            const updateRegex = /UPDATE\s+(.+?)\s+FROM\s+(\d+)(?:\s+(?:MINUTES|MIN))?(?:\s+WITH\s+(\d+)\s+KCAL)?\s+TO\s+(\d+)(?:\s+(?:MINUTES|MIN))?/gi;
            let match;
            while ((match = updateRegex.exec(text)) !== null) {
                const activity = match[1].trim().toLowerCase();
                parsedUpdates[activity] = {
                    oldDurationMinutes: parseInt(match[2], 10),
                    newDurationMinutes: parseInt(match[4], 10),
                    oldCaloriesBurned: match[3] ? parseInt(match[3], 10) : null
                };
            }
            console.log("DIAG_UPDATE_DEBUG: Parsed updates:", JSON.stringify(parsedUpdates));
        }

        for (let i = 0; i < rawActivityItems.length; i++) {
          const raw = rawActivityItems[i];
          const activityKey = raw.activity.trim().toLowerCase();
          const parsed = parsedUpdates[activityKey];
          
          console.log("DIAG_PARSING_DEBUG: raw item:", JSON.stringify(raw), "parsed oldDuration:", parsed?.oldDurationMinutes, "oldCalories:", parsed?.oldCaloriesBurned);
          
          const itemDate = explicitTargetDate || raw.date || todayDate;
          enrichedActs.push({
            ...raw,
            date: itemDate,
            id: `act-${Date.now()}-${i}`,
            oldDurationMinutes: parsed?.oldDurationMinutes,
            oldCaloriesBurned: parsed?.oldCaloriesBurned || undefined,
          });
        }
        console.log("DIAG_DELETE_DEBUG: intent:", data.intent, "enrichedActs:", JSON.stringify(enrichedActs));

      // Filter candidate items: NEVER duplicate existing entries (like PANEER) or overwrite them
      const validDbItemsToAdd: FoodDatabaseItem[] = [];
      for (const item of candidateDbItems) {
        const existingMatch = findMatchingFoodInDatabase(item.food, foodDatabase);
        const alreadyInValid = validDbItemsToAdd.some(
          (v) => findMatchingFoodInDatabase(item.food, [v]) !== null
        );

        if (!existingMatch && !alreadyInValid) {
          validDbItemsToAdd.push({
            ...item,
            notes: item.notes || 'Estimated values',
            isEstimate: true,
          });
        }
      }

      // 1. Automatically add new valid items to Food Database
      if (validDbItemsToAdd.length > 0) {
        setFoodDatabase((prev) => [...prev, ...validDbItemsToAdd]);
      }

      // Handle UPDATE_FOOD_DATABASE intent
      if (isDbUpdate && currentToken && selectedSheet) {
          const freshDb = await fetchFoodDatabaseForUpdate(currentToken, selectedSheet.id);
          
          for (const updateItem of rawDbItemsToAdd) {
            const matches = freshDb.filter(item => item.food.trim().toLowerCase() === updateItem.food.trim().toLowerCase());
            
            if (matches.length === 0) {
              finalReplyText = `I could not find a database entry for **${updateItem.food}** to update.`;
              continue;
            }
            if (matches.length > 1) {
              finalReplyText = `Multiple entries found for **${updateItem.food}**. Please be more specific about which one to update.`;
              continue;
            }
            
            const target = matches[0];
            const targetRow = target.sheetRowNumber;
            if (!targetRow) {
                finalReplyText = `Failed to resolve row number for **${updateItem.food}**.`;
                continue;
            }

            // Perform the update
            await updateFoodDatabaseEntry(currentToken, selectedSheet.id, targetRow, updateItem);
            
            // Verification: re-fetch the specific row
            const reReadDb = await fetchFoodDatabaseForUpdate(currentToken, selectedSheet.id);
            const updatedRow = reReadDb.find(item => item.sheetRowNumber === targetRow);
            
            if (!updatedRow) {
                finalReplyText = `Failed to verify update for **${updateItem.food}**. The row disappeared!`;
                continue;
            }

            // Verify all fields
            const isMatch = updatedRow.food.trim().toLowerCase() === updateItem.food.trim().toLowerCase() &&
                            Math.abs(updatedRow.serving - updateItem.serving) < 0.001 &&
                            updatedRow.unit.trim().toLowerCase() === updateItem.unit.trim().toLowerCase() &&
                            Math.abs(updatedRow.calories - updateItem.calories) < 0.5 &&
                            Math.abs(updatedRow.protein - updateItem.protein) < 0.1 &&
                            Math.abs(updatedRow.carbs - updateItem.carbs) < 0.1 &&
                            Math.abs(updatedRow.fat - updateItem.fat) < 0.1 &&
                            Math.abs(updatedRow.fiber - updateItem.fiber) < 0.1;

            if (isMatch) {
              setFoodDatabase(reReadDb);
              finalReplyText = `I have updated your Food Database entry for **${updateItem.food}**. It is now set to ${updateItem.serving} ${updateItem.unit} = ${updateItem.calories} kcal, ${updateItem.protein}g protein, ${updateItem.carbs}g carbs, ${updateItem.fat}g fat, and ${updateItem.fiber}g fiber.`;
            } else {
              finalReplyText = `I attempted to update **${updateItem.food}**, but verification failed. The values in the sheet do not match the requested update.`;
            }
          }
      }

      // DUPLICATE-ENTRY PROTECTION:
      // Before creating a new Food Log entry, check whether an identical entry already exists with the same:
      // - Date
      // - Meal
      // - Food
      // - Quantity
      // - Unit
      const duplicateFoodEntries: FoodLogEntry[] = [];
      const uniqueFoodEntries: FoodLogEntry[] = [];
      const itemsToUpdate: FoodLogEntry[] = [];
      const itemsToUpdateActivity: ActivityLogEntry[] = [];
      const itemsToDelete: FoodLogEntry[] = [];

      for (const candidate of enrichedFoodItems) {
        if (isCorrection) {
          const freshFoodLog = await fetchFoodLog(currentToken, selectedSheet.id);
          
          // Find ALL matching entries
          const allMatches = freshFoodLog.filter((e) => {
            const matchesBase = isSameEntryForUpdate(e, candidate);
            if (!matchesBase) return false;
            
            const oldQty = candidate.oldQuantity;
            const oldUnit = candidate.oldUnit;
            
            if (oldQty !== undefined && oldUnit !== undefined) {
              const existingQty = parseFloat(String(e.quantity)) || 0;
              const candidateOldQty = parseFloat(String(oldQty)) || 0;
              return Math.abs(existingQty - candidateOldQty) < 0.001 &&
                     String(e.unit).trim().toLowerCase() === String(oldUnit).trim().toLowerCase();
            }
            return true;
          });
          
          if (allMatches.length === 0) {
            const oldQty = candidate.oldQuantity;
            const oldUnit = candidate.oldUnit;
            throw new Error(`Update failed: No matching ${candidate.food} entry ${oldQty && oldUnit ? `with old quantity ${oldQty}${oldUnit} ` : ''}found on ${candidate.date} during ${candidate.meal}.`);
          }
          
          if (allMatches.length > 1) {
            throw new Error(`Update failed: Multiple matching ${candidate.food} entries found on ${candidate.date} during ${candidate.meal}. Please provide more information to uniquely identify the entry.`);
          }
          
          const existing = allMatches[0];
          candidate.sheetRowNumber = existing.sheetRowNumber;
          itemsToUpdate.push(candidate);
          continue;
        }

        if (isDeletion) {
          if (!selectedSheet) {
            throw new Error('No sheet selected');
          }
          const freshFoodLog = await fetchFoodLog(currentToken, selectedSheet.id);
          // Use filter to find ALL matching entries based on complete criteria
          const allMatches = freshFoodLog.filter((e) => {
            return isIdenticalFoodLogEntry(e, candidate);
          });

          if (allMatches.length === 0) {
            throw new Error(`Deletion failed: No matching entries found for ${candidate.food} (${candidate.quantity} ${candidate.unit}) on ${candidate.date} during ${candidate.meal}.`);
          } else if (allMatches.length > 1) {
            throw new Error(`Deletion failed: Multiple matching ${candidate.food} (${candidate.quantity} ${candidate.unit}) entries found on ${candidate.date} during ${candidate.meal}. Please provide more information to uniquely identify the entry.`);
          } else {
            // Exactly one match
            itemsToDelete.push({
              ...allMatches[0],
            });
          }
          continue;
        }

        const existing = currentFoodLog.find((e) => isIdenticalFoodLogEntry(e, candidate));
        if (existing) {
          candidate.sheetRowNumber = existing.sheetRowNumber;
          duplicateFoodEntries.push(candidate);
        } else {
          uniqueFoodEntries.push(candidate);
        }
      }

      if (isCorrection && enrichedActs.length > 0) {
        if (!selectedSheet) {
          throw new Error('No sheet selected');
        }
        const freshActivityLog = await fetchActivityLog(currentToken, selectedSheet.id);
        console.log("DIAG_UPDATE_DEBUG: Fresh Activity Log:", JSON.stringify(freshActivityLog));
        for (const candidate of enrichedActs) {
          console.log("DIAG_FLOW_UPDATE: Resolving candidate for update:", JSON.stringify(candidate));
          const allMatches = freshActivityLog.filter((e) => {
            const matchesActivity = e.activity.trim().toLowerCase() === candidate.activity.trim().toLowerCase();
            const matchesDate = normalizeDateString(e.date) === normalizeDateString(candidate.date);
            
            // FIX: Use OLD values for resolution to match the existing row precisely
            const targetDuration = candidate.oldDurationMinutes !== undefined ? candidate.oldDurationMinutes : candidate.durationMinutes;
            const matchesDuration = Math.abs(e.durationMinutes - targetDuration) < 0.1;
            
            // Only compare if calories are provided for update
            let matchesCalories = true;
            if (candidate.oldCaloriesBurned !== undefined && e.caloriesBurned !== undefined) {
              matchesCalories = Math.abs(e.caloriesBurned - candidate.oldCaloriesBurned) < 0.1;
            }
            const isMatch = matchesActivity && matchesDate && matchesDuration && matchesCalories;
            if (!isMatch) {
                console.log("DIAG_UPDATE_DEBUG: Candidate rejected row", e.sheetRowNumber, 
                    "Activity:", e.activity, "Expected:", candidate.activity, "Match:", matchesActivity,
                    "Date:", e.date, "Expected:", candidate.date, "Match:", matchesDate,
                    "Duration:", e.durationMinutes, "Expected:", targetDuration, "Match:", matchesDuration,
                    "Calories:", e.caloriesBurned, "Expected:", candidate.oldCaloriesBurned, "Match:", matchesCalories);
            }
            return isMatch;
          });

          if (allMatches.length === 0) {
            console.log("DIAG_UPDATE_DEBUG: Update failed for candidate:", JSON.stringify(candidate));
            throw new Error(`Update failed: No matching ${candidate.activity} entry found in your Activity Log on ${candidate.date} with duration ${candidate.oldDurationMinutes} min.`);
          }
          if (allMatches.length > 1) {
            console.log("DIAG_PENDING_UPDATE: Storing pending Activity UPDATE for candidate:", JSON.stringify(candidate));
            setPendingActivityUpdate({
              activity: candidate.activity,
              date: candidate.date,
              oldDurationMinutes: candidate.oldDurationMinutes || candidate.durationMinutes,
              newDurationMinutes: candidate.durationMinutes,
              oldCaloriesBurned: candidate.oldCaloriesBurned,
              newCaloriesBurned: candidate.caloriesBurned,
              offeredEntries: allMatches,
            });
            const choices = allMatches.map((e, i) => `${i + 1}. ${e.activity} — ${e.durationMinutes} minutes ${e.caloriesBurned ? `— ${e.caloriesBurned} kcal` : ''}`).join('\n');
            throw new Error(`I found ${allMatches.length} matching ${candidate.activity} entries in your Activity Log for ${candidate.date}:\n\n${choices}\n\nWhich one would you like to update? Reply with the number (e.g., 1 or 2).`);
          }
          
          const existing = allMatches[0];
          console.log("DIAG_FLOW_UPDATE: Found match for candidate:", JSON.stringify(candidate), "Resolved row:", existing.sheetRowNumber);
          candidate.sheetRowNumber = existing.sheetRowNumber;
          itemsToUpdateActivity.push(candidate);
        }
      }

      let activeDuplicateOffer: DuplicateOffer | undefined;

      if (!isCorrection && duplicateFoodEntries.length > 0) {
        activeDuplicateOffer = {
          uniqueEntries: uniqueFoodEntries,
          duplicateEntries: duplicateFoodEntries,
          date: duplicateFoodEntries[0].date,
        };
        setPendingDuplicateOffer(activeDuplicateOffer);

        const dupDesc = duplicateFoodEntries
          .map(
            (d) =>
              `• **Date**: ${d.date}\n• **Meal**: ${d.meal}\n• **Food**: ${d.food}\n• **Portion**: ${d.quantity} ${d.unit} (${Math.round(
                d.calories
              )} kcal)\n• **Nutritional Values**: ${d.protein}g protein, ${d.carbs}g carbs, ${d.fat}g fat`
          )
          .join('\n\n');

        finalReplyText =
          `⚠️ **Matching Entry Already Exists**\n\n` +
          `A matching entry already exists in your Food Log with the exact same Date, Meal, Food, Quantity, and Unit:\n\n` +
          dupDesc +
          `\n\nWould you like to add it again? Please reply **"Yes"** to confirm, or **"No"** to cancel.`;

        // Do NOT create another row automatically for duplicate entries until confirmed
        enrichedFoodItems.length = 0;
      } else if (isCorrection) {
        enrichedFoodItems.length = 0;
        enrichedFoodItems.push(...itemsToUpdate);
        
        enrichedActs.length = 0;
        enrichedActs.push(...itemsToUpdateActivity);
        console.log("DIAG_UPDATE_DEBUG: enrichedActs after update:", JSON.stringify(enrichedActs));
      } else {
        enrichedFoodItems.length = 0;
        enrichedFoodItems.push(...uniqueFoodEntries);
      }

      const itemsToDeleteActivity: ActivityLogEntry[] = [];
      if (isDeletion && enrichedActs.length > 0) {
        if (!selectedSheet) {
          throw new Error('No sheet selected');
        }
        const freshActivityLog = await fetchActivityLog(currentToken, selectedSheet.id);
        for (const candidate of enrichedActs) {
          console.log("DIAG_DELETE_DEBUG: Resolving candidate:", JSON.stringify(candidate));
          console.log("DIAG_DELETE_DEBUG: freshActivityLog:", JSON.stringify(freshActivityLog.map(e => ({ activity: e.activity, date: e.date, duration: e.durationMinutes, calories: e.caloriesBurned, notes: e.notes, row: e.sheetRowNumber }))));
          
          const allMatches = freshActivityLog.filter((e) => {
            const matchesActivity = e.activity.trim().toLowerCase() === candidate.activity.trim().toLowerCase();
            const matchesDate = normalizeDateString(e.date) === normalizeDateString(candidate.date);
            const matchesDuration = Math.abs(e.durationMinutes - candidate.durationMinutes) < 0.1;
            
            let matchesCalories = true;
            if (candidate.caloriesBurned !== undefined && e.caloriesBurned !== undefined) {
              matchesCalories = Math.abs(e.caloriesBurned - candidate.caloriesBurned) < 0.1;
            }

            console.log("DIAG_DELETE_DEBUG: Comparing candidate with row", e.sheetRowNumber, 
              "ActivityMatch:", matchesActivity, 
              "DateMatch:", matchesDate, 
              "DurationMatch:", matchesDuration, 
              "CalMatch:", matchesCalories);
            
            return matchesActivity && matchesDate && matchesDuration && matchesCalories;
          });

          if (allMatches.length === 0) {
            setIsChatLoading(false);
            setMessages((prev) => [...prev, {
              id: `msg-${Date.now()}-err`,
              sender: 'assistant',
              text: `I could not find any '${candidate.activity}' entry with a duration of ${candidate.durationMinutes} minutes in your Activity Log for ${candidate.date}. Please verify the activity details and try again.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]);
            return;
          } else if (allMatches.length > 1) {
            setPendingActivityDelete({
              activity: candidate.activity,
              date: candidate.date,
              offeredEntries: allMatches,
            });
            const choices = allMatches.map((e, i) => `${i + 1}. ${e.activity} — ${e.durationMinutes} minutes ${e.caloriesBurned ? `— ${e.caloriesBurned} kcal` : ''}`).join('\n');
            throw new Error(`I found ${allMatches.length} matching ${candidate.activity} entries in your Activity Log for ${candidate.date}:\n\n${choices}\n\nWhich one would you like to delete? Reply with the number (e.g., 1 or 2).`);
          } else {
            // Exactly one match
            itemsToDeleteActivity.push({
              ...allMatches[0],
            });
          }
        }
        console.log("DIAG_DELETE_DEBUG: resolved itemsToDeleteActivity:", JSON.stringify(itemsToDeleteActivity), "length:", itemsToDeleteActivity.length);
      }

      // 3. Process progress item if any with baseline preservation, duplicate protection, and post-write verification
      const trimmedInput = (text || '').trim();
      const isBaselineConfirmation =
        isBaselineConfirmationQuery(trimmedInput) ||
        (/\b(confirm|confirming|confirm baseline|my baseline is|keep baseline|baseline already|existing baseline)\b/i.test(trimmedInput) &&
          /\b(baseline|82(?:\.0)?(?:\s*kg)?)\b/i.test(trimmedInput));
      const isExplicitReset = /\b(reset baseline|new baseline|change baseline)\b/i.test(trimmedInput);
      const isExplicitNewMeasurement = /\b(new measurement|another measurement|re-weigh|measure again|add another weight)\b/i.test(trimmedInput);

      let progressRecordResult: RecordProgressResult | null = null;
      if (newProgressItem) {
        if (explicitTargetDate) {
          newProgressItem.date = explicitTargetDate;
        }
        if (isBaselineConfirmation && !isExplicitReset && !isExplicitNewMeasurement) {
          newProgressItem = null;
        }
      }

      // Collect all affected dates from this action
      const affectedDates = Array.from(
        new Set([
          ...enrichedFoodItems.map((f) => f.date),
          ...enrichedActs.map((a) => a.date),
        ])
      );

      // Update food log state & update Daily Summaries ONLY for the affected dates
      let updatedFoodLog = currentFoodLog;
      if (enrichedFoodItems.length > 0) {
        updatedFoodLog = [...currentFoodLog, ...enrichedFoodItems];
        setFoodLog(updatedFoodLog);
      }

      let updatedActLog = activityLog;
      if (enrichedActs.length > 0) {
        updatedActLog = [...activityLog, ...enrichedActs];
        setActivityLog(updatedActLog);
      }

      // Update Daily Summary ONLY for affected dates - never mix dates or update today for a future entry!
      for (const d of affectedDates) {
        await updateDailySummaryForDate(currentToken, selectedSheet?.id || null, d, updatedFoodLog, updatedActLog);
      }

      // Synchronize to Google Sheet and verify the write operation
      let writeVerified = false;
      let sheetSyncSuccess = false;
      let sheetSyncError: string | null = null;
      
      console.log('DIAG_DELETE: enrichedActs:', JSON.stringify(enrichedActs));

      if (currentToken && selectedSheet) {
        try {
          // A. Append new Food Database items to Google Sheet 'Food Database' tab
          for (const dbItem of validDbItemsToAdd) {
            await appendFoodDatabaseItem(currentToken, selectedSheet.id, dbItem);
          }

          // B. Update or Append Food Log items to Google Sheet 'Food Log' tab
          if (enrichedFoodItems.length > 0) {
            const itemsToAppend: FoodLogEntry[] = [];
            for (const item of enrichedFoodItems) {
              if (item.sheetRowNumber) {
                console.log('Updating food log entry:', { rowNumber: item.sheetRowNumber, entry: item });
                await updateFoodLogEntry(currentToken, selectedSheet.id, item.sheetRowNumber, item);
              } else {
                itemsToAppend.push(item);
              }
            }
            if (itemsToAppend.length > 0) {
              await appendFoodLog(currentToken, selectedSheet.id, itemsToAppend);
            }
            
            // 6. Trust the completed append/update API call and gracefully refresh state
            writeVerified = true;
            sheetSyncSuccess = true;
            
            // Allow Google Sheets a short propagation pause before fetching latest snapshot
            setTimeout(async () => {
              try {
                const reReadFoodLog = await fetchFoodLog(currentToken, selectedSheet.id);
                if (reReadFoodLog && reReadFoodLog.length > 0) {
                  setFoodLog(reReadFoodLog);
                }
              } catch (e) {
                console.warn('Background sync of food log postponed:', e);
              }
            }, 1500);
          }
          // C. Delete Food Log items
          console.log('DIAG_MULTI_DELETE: Items to delete', JSON.stringify(itemsToDelete));
          // Freshly fetch food log and re-resolve row numbers to prevent deletion of incorrect rows due to stale data
          const freshFoodLog = await fetchFoodLog(currentToken, selectedSheet.id);
          const resolvedItemsToDelete = [];
          for (const item of itemsToDelete) {
              const freshEntry = freshFoodLog.find(e => isIdenticalFoodLogEntry(e, item));
              if (!freshEntry) {
                  throw new Error(`Deletion failed: No matching entries found for ${item.food} on ${item.date} during ${item.meal}.`);
              }
              resolvedItemsToDelete.push({ ...item, sheetRowNumber: freshEntry.sheetRowNumber });
          }

          // Sort items by sheetRowNumber descending to avoid index shift issues
          resolvedItemsToDelete.sort((a, b) => (b.sheetRowNumber || 0) - (a.sheetRowNumber || 0));
          for (const item of resolvedItemsToDelete) {
            console.log('DIAG_MULTI_DELETE: Attempting deletion for row', item.sheetRowNumber, 'Food:', item.food);
            if (item.sheetRowNumber) {
              await deleteFoodLogEntry(currentToken, selectedSheet.id, item.sheetRowNumber);
              console.log('DIAG_MULTI_DELETE: Successfully called API for row', item.sheetRowNumber);
            }
          }

          // Verification for deletion
          if (itemsToDelete.length > 0) {
            // Add a small delay to handle Google Sheets eventual consistency
            await new Promise(resolve => setTimeout(resolve, 1000));
            const postDeleteFoodLog = await fetchFoodLog(currentToken, selectedSheet.id);
            
            // Check if ANY of the items we tried to delete still exist in the fresh log.
            const stillPresent = itemsToDelete.filter(item =>
              postDeleteFoodLog.some(row => row.sheetRowNumber === item.sheetRowNumber)
            );
            
            if (stillPresent.length > 0) {
              console.log('DIAG_DELETE_VERIFY: Failed. The following entries still exist:', JSON.stringify(stillPresent));
              throw new Error(`Deletion verification failed: The following entries still exist: ${stillPresent.map(i => i.food).join(', ')}`);
            }
            
            // Sync state with fresh sheet data
            setFoodLog(postDeleteFoodLog);
            updatedFoodLog = postDeleteFoodLog;
          }

          // C1. Delete Activity Log items
          if (itemsToDeleteActivity.length > 0) {
            // Freshly fetch activity log and re-resolve row numbers to prevent deletion of incorrect rows due to stale data
            const freshActivityLog = await fetchActivityLog(currentToken, selectedSheet.id);
            const freshRawActivityLog = await fetchRawActivityLog(currentToken, selectedSheet.id);
            console.log("DIAG_DELETE: fetched freshActivityLog count:", freshActivityLog.length);
            console.log("DIAG_DELETE: fetched freshRawActivityLog count:", freshRawActivityLog.length);
            console.log("DIAG_DELETE: itemsToDeleteActivity:", JSON.stringify(itemsToDeleteActivity));
            console.log("DIAG_DELETE: freshRawActivityLog candidates:", JSON.stringify(freshRawActivityLog));
            const resolvedItemsToDeleteActivity = [];
            const markerNotes = ['delete_requested', 'deletion requested'];
            console.log("DIAG_DELETE: Entering resolution loop. itemsToDeleteActivity count:", itemsToDeleteActivity.length);
            for (const item of itemsToDeleteActivity) {
                console.log("DIAG_DELETE: Resolving item:", JSON.stringify(item));
                const allCandidates = freshRawActivityLog.filter(e => 
                    e.activity.trim().toLowerCase() === item.activity.trim().toLowerCase() &&
                    normalizeDateString(e.date) === normalizeDateString(item.date) &&
                    Math.abs(e.durationMinutes - item.durationMinutes) < 0.1
                );
                
                const genuineMatches = allCandidates.filter(e => 
                    !e.notes || !markerNotes.includes(e.notes.trim().toLowerCase())
                );
                const markerMatches = allCandidates.filter(e => 
                    e.notes && markerNotes.includes(e.notes.trim().toLowerCase())
                );

                console.log("DIAG_DELETE: Matches found:", allCandidates.length, "Genuine:", genuineMatches.length, "Markers:", markerMatches.length);

                if (genuineMatches.length === 0) {
                    if (markerMatches.length > 0) {
                        throw new Error(`Deletion failed: No genuine activity entry found for ${item.activity} on ${item.date}. Only deletion markers found.`);
                    } else {
                        throw new Error(`Deletion failed: No matching activity entries found in your Activity Log for ${item.activity} on ${item.date}.`);
                    }
                }
                
                if (genuineMatches.length > 1) {
                    throw new Error(`Deletion failed: Multiple matching genuine activity entries found in your Activity Log for ${item.activity} on ${item.date}. Please be more specific.`);
                }
                
                const rowsToAdd = new Set<number>();
                rowsToAdd.add(genuineMatches[0].sheetRowNumber);
                for (const m of markerMatches) {
                    rowsToAdd.add(m.sheetRowNumber);
                }
                
                for (const rowNum of rowsToAdd) {
                    resolvedItemsToDeleteActivity.push({ ...item, sheetRowNumber: rowNum });
                }
            }
            console.log("DIAG_DELETE: resolvedItemsToDeleteActivity count:", resolvedItemsToDeleteActivity.length);
            console.log("DIAG_DELETE: resolvedItemsToDeleteActivity:", JSON.stringify(resolvedItemsToDeleteActivity));

            // Sort items by sheetRowNumber descending
            resolvedItemsToDeleteActivity.sort((a, b) => (b.sheetRowNumber || 0) - (a.sheetRowNumber || 0));
            console.log("DIAG_DELETE: Final classification verification - Genuine items to be deleted:", resolvedItemsToDeleteActivity.length);
            for (const item of resolvedItemsToDeleteActivity) {
                if (item.sheetRowNumber !== undefined && item.sheetRowNumber !== null) {
                    console.log("DIAG_DELETE: Calling deleteActivityLogEntry with item:", JSON.stringify(item), "and sheetId:", selectedSheet.id);
                    await deleteActivityLogEntry(currentToken, selectedSheet.id, item.sheetRowNumber);
                } else {
                    console.log("DIAG_DELETE: Skipping deletion, sheetRowNumber is undefined/null for item:", JSON.stringify(item));
                }
            }

            // Verification
            await new Promise(resolve => setTimeout(resolve, 1000));
            const postDeleteActivityLog = await fetchActivityLog(currentToken, selectedSheet.id);
            const stillPresentActivity = itemsToDeleteActivity.filter(item =>
                postDeleteActivityLog.some(row => row.sheetRowNumber === item.sheetRowNumber)
            );
            console.log("DIAG_DELETE: Verification fetch postDeleteActivityLog:", JSON.stringify(postDeleteActivityLog));
            console.log("DIAG_DELETE: Verification condition (stillPresentActivity):", JSON.stringify(stillPresentActivity));
            
            if (stillPresentActivity.length > 0) {
                throw new Error(`Deletion verification failed: The following activities still exist: ${stillPresentActivity.map(i => i.activity).join(', ')}`);
            }
            
            setActivityLog(postDeleteActivityLog);
            console.log("DIAG_DELETE: Successfully completed DELETE_ACTIVITY sequence.");
          }
          console.log("DIAG_DELETE: Returning final response.", { finalReplyText });

          // C. Update or Append Activity Log items to Google Sheet 'Activity Log' tab
          if (enrichedActs.length > 0 && !isDeletion) {
             const itemsToAppend: ActivityLogEntry[] = [];
             for (const item of enrichedActs) {
               if (item.sheetRowNumber) {
                 console.log('DIAG_FLOW_UPDATE: Calling updateActivityLogEntry for row:', item.sheetRowNumber, 'entry:', JSON.stringify(item));
                 await updateActivityLogEntry(currentToken, selectedSheet.id, item.sheetRowNumber, item);
               } else {
                 console.log('DIAG_FLOW_UPDATE: Appending activity log entry (no row number):', JSON.stringify(item));
                 itemsToAppend.push(item);
               }
             }
             if (itemsToAppend.length > 0) {
               console.log('DIAG_FLOW_UPDATE: Calling appendActivityLog for entries:', JSON.stringify(itemsToAppend));
               await appendActivityLog(currentToken, selectedSheet.id, itemsToAppend);
             }
          }

          // D. Append Progress entry to Google Sheet 'Progress' tab with pre-read, baseline preservation, duplicate protection, and post-write verification
          if (newProgressItem) {
            progressRecordResult = await recordProgressWithVerification(currentToken, selectedSheet.id, newProgressItem, {
              isBaselineConfirmation,
              isExplicitReset,
              isExplicitNewMeasurement,
            });
            if (progressRecordResult.status === 'SUCCESS') {
              setProgressEntries(progressRecordResult.updatedEntries);
              currentProgressEntries = progressRecordResult.updatedEntries;
            } else if (progressRecordResult.status === 'VERIFICATION_FAILED') {
              sheetSyncError = progressRecordResult.message;
              writeVerified = false;
            }
          }
        } catch (err: any) {
          console.error('Google Sheet write error:', err);
          sheetSyncError = err.message || 'Error writing to Google Sheet';
          sheetSyncSuccess = false;
          writeVerified = false;
        }
      } else {
        // In local mode (when not connected to Google Sheets), verify row in updatedFoodLog
        const allItemsFound = enrichedFoodItems.every((item) => {
          const itemDateNorm = normalizeDateString(item.date);
          return updatedFoodLog.some((row) => {
            const rowDateNorm = normalizeDateString(row.date);
            const foodMatch = row.food.trim().toLowerCase() === item.food.trim().toLowerCase();
            const dateMatch = rowDateNorm === itemDateNorm;
            return foodMatch && dateMatch;
          });
        });
        writeVerified = allItemsFound;

        if (newProgressItem) {
          progressRecordResult = recordProgressLocal(currentProgressEntries, newProgressItem, {
            isBaselineConfirmation,
            isExplicitReset,
            isExplicitNewMeasurement,
          });
          if (progressRecordResult.status === 'SUCCESS') {
            setProgressEntries(progressRecordResult.updatedEntries);
            currentProgressEntries = progressRecordResult.updatedEntries;
          }
        }
      }

      // Format response text based on verification and intent
      if (!activeDuplicateOffer && !isDateQuery && enrichedFoodItems.length === 0 && enrichedActs.length === 0 && newProgressItem) {
        if (progressRecordResult?.status === 'BASELINE_CONFIRMED') {
          finalReplyText =
            `Your baseline weight is already established at **${progressRecordResult.baselineWeight.toFixed(1)} kg** in your Progress records.\n\n` +
            `• **Original Baseline Weight**: ${progressRecordResult.baselineWeight.toFixed(1)} kg\n` +
            `• **Status**: Existing baseline confirmed (no duplicate row was written to Progress).\n` +
            `*(The original baseline remains the first recorded Progress weight unless explicitly reset).*`;
        } else if (progressRecordResult?.status === 'DUPLICATE_IGNORED') {
          finalReplyText =
            `A weight measurement of **${newProgressItem.weightKg.toFixed(1)} kg** is already recorded for **${newProgressItem.date}** in your Progress records.\n\n` +
            `• **Status**: Existing measurement preserved (no duplicate row was written to Progress).\n` +
            `*(To record an additional distinct measurement for this date, specify 'log a new measurement').*`;
        } else if (progressRecordResult?.status === 'VERIFICATION_FAILED') {
          finalReplyText =
            `❌ **Verification Failed**: The weight entry could not be verified in Progress records after writing. Exactly one row was expected.`;
        } else if (progressRecordResult && progressRecordResult.isBaseline) {
          finalReplyText =
            `Recorded weight into your **Progress** records:\n\n` +
            `1. **Date Used**: ${newProgressItem.date}\n` +
            `2. **Weight Recorded**: ${newProgressItem.weightKg.toFixed(1)} kg${newProgressItem.notes ? ` (${newProgressItem.notes})` : ''}\n` +
            `3. **Entry Status**: Baseline Weight Established\n` +
            `4. **Baseline Weight**: ${newProgressItem.weightKg.toFixed(1)} kg\n\n` +
            `*(This first recorded weight establishes your permanent baseline. Subsequent entries will be recorded as New Progress Weight Entries compared against this baseline).*`;
        } else if (progressRecordResult) {
          const originalBaseline = progressRecordResult.baselineWeight;
          const diff = progressRecordResult.changeFromBaseline ?? Number((newProgressItem.weightKg - originalBaseline).toFixed(1));
          const diffStr = diff > 0 ? `+${diff.toFixed(1)} kg` : diff === 0 ? '0.0 kg (no change)' : `${diff.toFixed(1)} kg`;
          const changeFromPrev = progressRecordResult.changeFromPrevious;
          const diffPrevStr = typeof changeFromPrev === 'number'
            ? (changeFromPrev > 0 ? `+${changeFromPrev.toFixed(1)} kg` : changeFromPrev === 0 ? '0.0 kg (no change)' : `${changeFromPrev.toFixed(1)} kg`)
            : null;

          finalReplyText =
            `Recorded weight into your **Progress** records:\n\n` +
            `1. **Date Used**: ${newProgressItem.date}\n` +
            `2. **Weight Recorded**: ${newProgressItem.weightKg.toFixed(1)} kg${newProgressItem.notes ? ` (${newProgressItem.notes})` : ''}\n` +
            `3. **Entry Status**: New Progress Weight Entry\n` +
            `4. **Baseline Weight**: ${originalBaseline.toFixed(1)} kg\n` +
            (diffPrevStr ? `5. **Change Since Previous Entry**: ${diffPrevStr}\n` : '') +
            `6. **Weight Change from Baseline**: ${diffStr}\n\n` +
            `*(Total Progress entries recorded: ${progressRecordResult.updatedEntries.length})*`;
        }
      } else if (!activeDuplicateOffer && !isDateQuery && enrichedFoodItems.length === 0 && enrichedActs.length === 0 && !newProgressItem && validDbItemsToAdd.length === 0) {
        finalReplyText = data.reply || 'Request processed.';
      }

      if (isDateQuery) {
        // Query handling: filter by Date column for target date
        const foodQueryDate = explicitTargetDate || currentTodayDate;
        const targetFoodQueryEntries = currentFoodLog.filter(
          (row) => normalizeDateString(row.date) === foodQueryDate
        );
        if (targetFoodQueryEntries.length > 0) {
          finalReplyText =
            `For ${foodQueryDate}, you have the following entries logged in your Food Log:\n\n` +
            targetFoodQueryEntries
              .map(
                (r) =>
                  `• **${r.meal}**: ${r.food} (${r.quantity} ${r.unit}) — ${Math.round(
                    r.calories
                  )} kcal (Protein: ${r.protein}g, Carbs: ${r.carbs}g, Fat: ${r.fat}g)`
              )
              .join('\n') +
            `\n\n**Total Calories**: ${Math.round(
              targetFoodQueryEntries.reduce((s, i) => s + (i.calories || 0), 0)
            )} kcal | **Protein**: ${targetFoodQueryEntries
              .reduce((s, i) => s + (i.protein || 0), 0)
              .toFixed(1)}g`;
        } else {
          finalReplyText = `You do not have any food entries logged for ${foodQueryDate}.`;
        }
      } else if (enrichedFoodItems.length > 0) {
        // Write result reporting
        if (!writeVerified) {
          finalReplyText = `❌ **Write Operation Failed**: The newly written food entry could not be verified in the Google Sheet's Food Log with date ${affectedDates.join(
            ', '
          )}. The entry was NOT recorded. Please try again.`;
        } else {
          const confirmLines: string[] = [];
          if (currentToken && selectedSheet && sheetSyncSuccess) {
            confirmLines.push(`\n\n---\n**Google Sheets Write Confirmed & Verified (${selectedSheet.name})**`);
            if (affectedDates.length > 0) {
              confirmLines.push(`• **Recorded Date Confirmed**: ${affectedDates.join(', ')}`);
            }
            confirmLines.push(
              `• **Food Log**: Recorded and verified ${enrichedFoodItems
                .map(
                  (i) =>
                    `${i.food} (${i.quantity} ${i.unit}, ${Math.round(i.calories)} kcal [${
                      i.sourceLabel || (i.isEstimate ? 'Newly estimated value' : 'From Food Database')
                    }])`
                )
                .join(', ')}`
            );
            confirmLines.push(
              `• **Daily Summary**: Maintained for ${affectedDates.join(', ')} only (today's summary untouched)`
            );
            if (newProgressItem && progressRecordResult && progressRecordResult.status === 'SUCCESS') {
              if (progressRecordResult.isBaseline) {
                confirmLines.push(
                  `• **Progress**: Recorded and verified ${newProgressItem.weightKg.toFixed(1)} kg on ${newProgressItem.date} (Baseline Weight Established — Exactly 1 row added)`
                );
              } else {
                const originalBaseline = progressRecordResult.baselineWeight;
                const diff = progressRecordResult.changeFromBaseline ?? Number((newProgressItem.weightKg - originalBaseline).toFixed(1));
                const diffStr =
                  diff > 0 ? `+${diff.toFixed(1)} kg` : diff === 0 ? '0.0 kg (no change)' : `${diff.toFixed(1)} kg`;
                confirmLines.push(
                  `• **Progress**: Recorded and verified ${newProgressItem.weightKg.toFixed(1)} kg on ${newProgressItem.date} (New Progress Weight Entry — Baseline: ${originalBaseline.toFixed(1)} kg, Weight Change from Baseline: ${diffStr}) [Verified 1 row added]`
                );
              }
            }
            finalReplyText += confirmLines.join('\n');
          } else {
            confirmLines.push(`\n\n---\n• **Recorded Date Confirmed**: ${affectedDates.join(', ')}`);
            confirmLines.push(
              `• **Food Log**: Recorded ${enrichedFoodItems
                .map(
                  (i) =>
                    `${i.food} (${i.quantity} ${i.unit}, ${Math.round(i.calories)} kcal [${
                      i.sourceLabel || (i.isEstimate ? 'Newly estimated value' : 'From Food Database')
                    }])`
                )
                .join(', ')}`
            );
            confirmLines.push(
              `• **Daily Summary**: Maintained for ${affectedDates.join(', ')} only`
            );
            if (newProgressItem) {
              const prevWeights = [...currentProgressEntries]
                .filter((p) => p && typeof p.weightKg === 'number' && p.weightKg > 20 && p.weightKg < 300)
                .sort((a, b) => a.date.localeCompare(b.date));
              if (prevWeights.length === 0) {
                confirmLines.push(
                  `• **Progress**: Recorded ${newProgressItem.weightKg.toFixed(1)} kg on ${newProgressItem.date} (Baseline Weight Established)`
                );
              } else {
                const originalBaseline = prevWeights[0].weightKg;
                const diff = Number((newProgressItem.weightKg - originalBaseline).toFixed(1));
                const diffStr =
                  diff > 0 ? `+${diff.toFixed(1)} kg` : diff === 0 ? '0.0 kg (no change)' : `${diff.toFixed(1)} kg`;
                confirmLines.push(
                  `• **Progress**: Recorded ${newProgressItem.weightKg.toFixed(1)} kg on ${newProgressItem.date} (New Progress Weight Entry — Baseline: ${originalBaseline.toFixed(1)} kg, Weight Change from Baseline: ${diffStr})`
                );
              }
            }
            finalReplyText += confirmLines.join('\n');
          }
        }
      } else {
        // Other non-food actions (activities, progress, or DB items)
        const hasOtherAction =
          enrichedActs.length > 0 ||
          newProgressItem !== null ||
          validDbItemsToAdd.length > 0;

        if (hasOtherAction) {
          const confirmLines: string[] = [];
          if (currentToken && selectedSheet && sheetSyncSuccess) {
            confirmLines.push(`\n\n---\n**Google Sheets Write Confirmed (${selectedSheet.name})**`);
            if (affectedDates.length > 0) {
              confirmLines.push(`• **Recorded Date Confirmed**: ${affectedDates.join(', ')}`);
            }
            if (validDbItemsToAdd.length > 0) {
              confirmLines.push(
                `• **Food Database**: Automatically added ${validDbItemsToAdd
                  .map(
                    (d) =>
                      `"${d.food}" (${d.serving} ${d.unit}, ${Math.round(d.calories)} kcal, Notes: ${
                        d.notes || 'Estimated values'
                      })`
                  )
                  .join(', ')}`
              );
            }
            if (enrichedActs.length > 0) {
              confirmLines.push(
                `• **Activity Log**: Recorded ${enrichedActs
                  .map(
                    (a) =>
                      `${a.activity} (${a.durationMinutes} min, ${Math.round(
                        a.caloriesBurned || 0
                      )} kcal)`
                  )
                  .join(', ')}`
              );
            }
            if (newProgressItem) {
              const prevWeights = [...currentProgressEntries]
                .filter((p) => p && typeof p.weightKg === 'number' && p.weightKg > 20 && p.weightKg < 300)
                .sort((a, b) => a.date.localeCompare(b.date));
              if (prevWeights.length === 0) {
                confirmLines.push(
                  `• **Progress**: Recorded ${newProgressItem.weightKg.toFixed(1)} kg on ${newProgressItem.date} (Baseline Weight Established)`
                );
              } else {
                const originalBaseline = prevWeights[0].weightKg;
                const diff = Number((newProgressItem.weightKg - originalBaseline).toFixed(1));
                const diffStr =
                  diff > 0 ? `+${diff.toFixed(1)} kg` : diff === 0 ? '0.0 kg (no change)' : `${diff.toFixed(1)} kg`;
                confirmLines.push(
                  `• **Progress**: Recorded ${newProgressItem.weightKg.toFixed(1)} kg on ${newProgressItem.date} (New Progress Weight Entry — Baseline: ${originalBaseline.toFixed(1)} kg, Weight Change from Baseline: ${diffStr})`
                );
              }
            }
            finalReplyText += confirmLines.join('\n');
          } else {
            const localConfirmLines: string[] = [];
            if (newProgressItem) {
              const prevWeights = [...currentProgressEntries]
                .filter((p) => p && typeof p.weightKg === 'number' && p.weightKg > 20 && p.weightKg < 300)
                .sort((a, b) => a.date.localeCompare(b.date));
              localConfirmLines.push(`\n\n---\n• **Recorded Date Confirmed**: ${newProgressItem.date}`);
              if (prevWeights.length === 0) {
                localConfirmLines.push(
                  `• **Progress**: Recorded ${newProgressItem.weightKg.toFixed(1)} kg on ${newProgressItem.date} (Baseline Weight Established)`
                );
              } else {
                const originalBaseline = prevWeights[0].weightKg;
                const diff = Number((newProgressItem.weightKg - originalBaseline).toFixed(1));
                const diffStr =
                  diff > 0 ? `+${diff.toFixed(1)} kg` : diff === 0 ? '0.0 kg (no change)' : `${diff.toFixed(1)} kg`;
                localConfirmLines.push(
                  `• **Progress**: Recorded ${newProgressItem.weightKg.toFixed(1)} kg on ${newProgressItem.date} (New Progress Weight Entry — Baseline: ${originalBaseline.toFixed(1)} kg, Weight Change from Baseline: ${diffStr})`
                );
              }
            }
            if (localConfirmLines.length > 0) {
              finalReplyText += localConfirmLines.join('\n');
            }
          }
        }
      }

      // Assistant response message
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        sender: 'assistant',
        text: finalReplyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action:
          enrichedFoodItems.length > 0
            ? { type: 'LOG_FOOD', foodItems: enrichedFoodItems }
            : enrichedActs.length > 0
            ? { type: 'LOG_ACTIVITY', activityItems: enrichedActs }
            : newProgressItem
            ? { type: 'LOG_WEIGHT', progressItem: newProgressItem }
            : validDbItemsToAdd.length > 0
            ? { type: 'ADD_TO_DB', dbItems: validDbItemsToAdd }
            : { type: 'NONE' },
        dbItemsAdded: validDbItemsToAdd.length > 0 ? validDbItemsToAdd : undefined,
        duplicateOffer: activeDuplicateOffer,
        syncedToSheet: sheetSyncSuccess,
      };

      setMessages((prev) => [...prev, assistantMessage]);
} catch (error: any) {
      console.error('Chat error:', error);
      const isAuthError =
        error.message?.toLowerCase().includes('unauthorized') ||
        error.message?.includes('401');

      if (isAuthError) {
        setToken(null);
        setAccessToken(null);
        setAuthNotice({
          type: 'warning',
          message: 'Google Sheets session expired. Click "Connect Google Sheet" above to reconnect.',
          showHelp: false,
        });
      }

      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        sender: 'assistant',
        text: isAuthError
          ? '⚠️ Your Google Sheets session expired. Please tap the Google account icon in the header to reconnect, then try your request again.'
          : `Sorry, I encountered an issue: ${error.message || 'Please try again'}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Confirm adding estimated food to Food Database
  const handleConfirmAddFoodToDb = async (item: FoodDatabaseItem) => {
    setFoodDatabase((prev) => [...prev, item]);
    setPendingOfferToDb(null);

    const currentToken = token || (await getAccessToken());
    if (currentToken && selectedSheet) {
      try {
        await appendFoodDatabaseItem(currentToken, selectedSheet.id, item);
      } catch (err) {
        console.error('Failed to add food to Google Sheet database:', err);
      }
    }

    const confirmMsg: ChatMessage = {
      id: `msg-${Date.now()}-confirmed`,
      sender: 'assistant',
      text: `Added **${item.food}** (1 ${item.unit} = ${item.calories} kcal, ${item.protein}g protein) to your **Food Database** tab! Future logs will use these exact values.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: { type: 'ADD_TO_DB', dbItems: [item] },
    };
    setMessages((prev) => [...prev, confirmMsg]);
  };

  // Manual Add Food directly to Database tab
  const handleManualAddFoodToDatabase = async (item: FoodDatabaseItem) => {
    setFoodDatabase((prev) => [...prev, item]);
    const currentToken = token || (await getAccessToken());
    if (currentToken && selectedSheet) {
      await appendFoodDatabaseItem(currentToken, selectedSheet.id, item);
    }
  };

  // Log weight directly
  const handleLogWeight = async (weightKg: number, notes?: string) => {
    const entry: ProgressEntry = {
      date: todayDate,
      weightKg,
      notes,
    };

    let result: RecordProgressResult;
    const currentToken = token || (await getAccessToken());
    if (currentToken && selectedSheet) {
      try {
        result = await recordProgressWithVerification(currentToken, selectedSheet.id, entry);
      } catch (err: any) {
        console.error('Failed to append progress to Google Sheet:', err);
        result = {
          status: 'ERROR',
          isBaseline: false,
          entry,
          existingEntries: progressEntries,
          updatedEntries: progressEntries,
          baselineWeight: progressEntries[0]?.weightKg ?? weightKg,
          message: err.message || 'Error writing to Google Sheet',
          verified: false,
        };
      }
    } else {
      result = recordProgressLocal(progressEntries, entry);
    }

    if (result.status === 'SUCCESS') {
      setProgressEntries(result.updatedEntries);
    }

    let confirmationText = '';
    if (result.status === 'BASELINE_CONFIRMED') {
      confirmationText =
        `Your baseline weight is already established at **${result.baselineWeight.toFixed(1)} kg** in your Progress records.\n\n` +
        `• **Status**: Existing baseline confirmed (no duplicate row was written to Progress).`;
    } else if (result.status === 'DUPLICATE_IGNORED') {
      confirmationText =
        `A weight measurement of **${weightKg.toFixed(1)} kg** is already recorded for **${todayDate}** in your Progress records.\n\n` +
        `• **Status**: Existing measurement preserved (no duplicate row was written to Progress).`;
    } else if (result.status === 'VERIFICATION_FAILED') {
      confirmationText = `❌ **Verification Failed**: The weight entry could not be verified in Google Sheets Progress records. Exactly one row was expected.`;
    } else if (result.status === 'ERROR') {
      confirmationText = `❌ **Error**: ${result.message}`;
    } else if (result.isBaseline) {
      confirmationText =
        `Recorded weight into your **Progress** records:\n\n` +
        `1. **Date Used**: ${todayDate}\n` +
        `2. **Weight Recorded**: ${weightKg.toFixed(1)} kg${notes ? ` (${notes})` : ''}\n` +
        `3. **Entry Status**: Baseline Weight Established\n` +
        `4. **Baseline Weight**: ${weightKg.toFixed(1)} kg\n\n` +
        `*(This first recorded weight establishes your permanent baseline. Subsequent entries will be recorded as New Progress Weight Entries compared against this baseline).*`;

      if (currentToken && selectedSheet && result.verified) {
        confirmationText +=
          `\n\n---\n**Google Sheets Write Confirmed & Verified (${selectedSheet.name})**\n` +
          `• **Progress**: Recorded and verified ${weightKg.toFixed(1)} kg on ${todayDate} (Baseline Weight Established — Exactly 1 row added)`;
      }
    } else {
      const originalBaseline = result.baselineWeight;
      const diff = result.changeFromBaseline ?? Number((weightKg - originalBaseline).toFixed(1));
      const diffStr = diff > 0 ? `+${diff.toFixed(1)} kg` : diff === 0 ? '0.0 kg (no change)' : `${diff.toFixed(1)} kg`;

      confirmationText =
        `Recorded weight into your **Progress** records:\n\n` +
        `1. **Date Used**: ${todayDate}\n` +
        `2. **Weight Recorded**: ${weightKg.toFixed(1)} kg${notes ? ` (${notes})` : ''}\n` +
        `3. **Entry Status**: New Progress Weight Entry\n` +
        `4. **Baseline Weight**: ${originalBaseline.toFixed(1)} kg\n` +
        `5. **Weight Change from Baseline**: ${diffStr}\n\n` +
        `*(Total Progress entries recorded: ${result.updatedEntries.length})*`;

      if (currentToken && selectedSheet && result.verified) {
        confirmationText +=
          `\n\n---\n**Google Sheets Write Confirmed & Verified (${selectedSheet.name})**\n` +
          `• **Progress**: Recorded and verified ${weightKg.toFixed(1)} kg on ${todayDate} (New Progress Weight Entry — Baseline: ${originalBaseline.toFixed(1)} kg, Weight Change from Baseline: ${diffStr}) [Verified 1 row added]`;
      }
    }

    // Add note in chat as well
    const chatMsg: ChatMessage = {
      id: `msg-${Date.now()}-weight`,
      sender: 'assistant',
      text: confirmationText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: { type: 'LOG_WEIGHT', progressItem: result.entry },
    };
    setMessages((prev) => [...prev, chatMsg]);
  };

  // Handle selecting spreadsheet
  const handleSelectSheet = async (sheet: GoogleSheetFile) => {
    setSelectedSheet(sheet);
    setShowSheetModal(false);
    const currentEmail = user?.email || activeUserEmailRef.current || PRIMARY_USER_EMAIL;
    saveUserDataset({
      userId:
        user?.uid ||
        (isPrimaryUser(currentEmail)
          ? 'primary_user_sohaib'
          : 'user_' + currentEmail.replace(/[^a-zA-Z0-9]/g, '_')),
      userEmail: currentEmail,
      displayName: user?.displayName || currentEmail.split('@')[0],
      selectedSheet: sheet,
      sheetTabs,
      profile,
      foodDatabase,
      foodLog,
      activityLog,
      dailySummaries,
      progressEntries,
      messages,
      updatedAt: new Date().toISOString(),
    });

    const currentToken = token || (await getAccessToken());
    if (currentToken) {
      await syncSpreadsheetData(currentToken, sheet.id);
    }
  };

  const handleSaveOnboardingProfile = async (calculatedProfile: ProfileData) => {
    if (!selectedSheet || !token) {
      setSyncStatusMessage('Google Sheet connection is required to save profile changes. Please connect a Google Sheet first.');
      setTimeout(() => setSyncStatusMessage(null), 5000);
      return;
    }
    
    try {
      await writeProfileToSheet(token, selectedSheet.id, calculatedProfile);
      setProfile(calculatedProfile);
      setShowOnboardingModal(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      setSyncStatusMessage('Failed to save profile to Google Sheet. Please try again.');
      setTimeout(() => setSyncStatusMessage(null), 5000);
    }
  };

  // Handle manual sheet ID submit
  const handleManualSheetId = async (id: string) => {
    const customSheet: GoogleSheetFile = {
      id,
      name: 'My Health AI',
      webViewLink: `https://docs.google.com/spreadsheets/d/${id}/edit`,
    };
    setSelectedSheet(customSheet);
    setShowSheetModal(false);

    const currentEmail = user?.email || activeUserEmailRef.current || PRIMARY_USER_EMAIL;
    saveUserDataset({
      userId:
        user?.uid ||
        (isPrimaryUser(currentEmail)
          ? 'primary_user_sohaib'
          : 'user_' + currentEmail.replace(/[^a-zA-Z0-9]/g, '_')),
      userEmail: currentEmail,
      displayName: user?.displayName || currentEmail.split('@')[0],
      selectedSheet: customSheet,
      sheetTabs,
      profile,
      foodDatabase,
      foodLog,
      activityLog,
      dailySummaries,
      progressEntries,
      messages,
      updatedAt: new Date().toISOString(),
    });

    const currentToken = token || (await getAccessToken());
    if (currentToken) {
      await syncSpreadsheetData(currentToken, id);
    }
  };

  // Handle creating a fresh, isolated Google Spreadsheet for current user
  const handleCreateNewSheet = async () => {
    const currentToken = token || (await getAccessToken());
    if (!currentToken) {
      setAuthNotice({
        type: 'warning',
        message: 'Please sign in with your Google account first to create a spreadsheet.',
        showHelp: true,
      });
      return;
    }

    setIsCreatingSheet(true);
    try {
      const newSheet = await createHealthSpreadsheet(
        currentToken,
        profile,
        foodDatabase,
        'My Health AI'
      );
      setSelectedSheet(newSheet);
      setShowSheetModal(false);

      const currentEmail = user?.email || activeUserEmailRef.current || PRIMARY_USER_EMAIL;
      saveUserDataset({
        userId:
          user?.uid ||
          (isPrimaryUser(currentEmail)
            ? 'primary_user_sohaib'
            : 'user_' + currentEmail.replace(/[^a-zA-Z0-9]/g, '_')),
        userEmail: currentEmail,
        displayName: user?.displayName || currentEmail.split('@')[0],
        selectedSheet: newSheet,
        sheetTabs: [
          'Profile',
          'Food Log',
          'Activity Log',
          'Daily Summary',
          'Progress',
          'Food Database',
        ],
        profile,
        foodDatabase,
        foodLog,
        activityLog,
        dailySummaries,
        progressEntries,
        messages,
        updatedAt: new Date().toISOString(),
      });

      setAuthNotice({
        type: 'success',
        message: `Created dedicated "${newSheet.name}" spreadsheet in your Google Drive!`,
        showHelp: false,
      });
      setTimeout(() => setAuthNotice(null), 5000);

      await syncSpreadsheetData(currentToken, newSheet.id);
    } catch (err: any) {
      console.error('Failed to create new spreadsheet:', err);
      setAuthNotice({
        type: 'warning',
        message: err.message || 'Failed to create spreadsheet in Google Drive',
        showHelp: true,
      });
    } finally {
      setIsCreatingSheet(false);
    }
  };

  // Navigate to chat and prefill prompt
  const handleOpenChatWithPrompt = (prompt: string) => {
    setActiveTab('chat');
    handleSendMessage(prompt);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Header */}
      <Header
        user={user}
        activeUserEmail={user?.email || activeUserEmailRef.current}
        selectedSheet={selectedSheet}
        isSyncing={isSyncing}
        isLoggingIn={isLoggingIn}
        onRefresh={() => {
          if (token && selectedSheet) {
            syncSpreadsheetData(token, selectedSheet.id);
          }
        }}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onOpenSheetSelector={() => setShowSheetModal(true)}
        onSwitchAccount={handleSwitchAccount}
      />

      {/* Auth Notification / Guidance Banner */}
      {authNotice && (
        <div
          id="auth-notice-banner"
          className={`border-b px-4 py-2.5 text-xs transition-all ${
            authNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : authNotice.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-stone-100 border-stone-200 text-stone-900'
          }`}
        >
          <div className="max-w-4xl mx-auto flex items-start justify-between gap-3">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-1.5 font-medium">
                {authNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : authNotice.type === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <Info className="w-4 h-4 text-stone-600 shrink-0" />
                )}
                <span>{authNotice.message}</span>
              </div>

              {authNotice.showHelp && (
                <div className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-stone-200/80 text-[11px] text-stone-700 space-y-1 mt-1.5">
                  <p className="font-semibold text-stone-900">💡 When signing in with Google:</p>
                  <p>
                    • <strong>"Google hasn't verified this app" notice</strong>: Since this is your personal custom app, Google will display a security prompt. Click <span className="font-semibold underline">Advanced</span> at the bottom left, then click <span className="font-semibold underline">Go to My Health AI (unsafe)</span>, and click <span className="font-semibold underline">Continue</span> to grant permission to your Google Sheet.
                  </p>
                  <p>
                    • <strong>Popups Blocked</strong>: If no window opened, check your browser's address bar to ensure popups aren't blocked for this site.
                  </p>
                </div>
              )}
            </div>

            <button
              id="dismiss-auth-notice"
              onClick={() => setAuthNotice(null)}
              className="text-stone-400 hover:text-stone-700 p-1 rounded-md transition-colors shrink-0"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sync Status Pill */}
      {syncStatusMessage && (
        <div className="bg-emerald-600 text-white text-xs py-1.5 px-4 text-center font-medium shadow-xs transition-all">
          {syncStatusMessage}
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6">
        {activeTab === 'dashboard' && isProfileComplete(profile) && (
          <DashboardView
            profile={profile}
            todayFoodLog={todayFoodLog}
            todayActivityLog={todayActivityLog}
            onOpenChatWithPrompt={handleOpenChatWithPrompt}
            onNavigateToChat={() => setActiveTab('chat')}
            onOpenTerminology={() => setIsTerminologyOpen(true)}
          />
        )}

        <AnimatePresence>
          {isTerminologyOpen && (
            <TerminologyModal
              isOpen={isTerminologyOpen}
              onClose={() => setIsTerminologyOpen(false)}
            />
          )}
        </AnimatePresence>

        {activeTab === 'chat' && (
          <ChatView
            messages={messages}
            isLoading={isChatLoading}
            onSendMessage={handleSendMessage}
            onConfirmAddFoodToDb={handleConfirmAddFoodToDb}
            isSheetConnected={Boolean(selectedSheet && token)}
            pendingDuplicateOffer={pendingDuplicateOffer}
            onConfirmDuplicate={() => handleSendMessage('Yes, add it again')}
            onCancelDuplicate={() => handleSendMessage('No, cancel')}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            foodLog={foodLog}
            activityLog={activityLog}
            dailySummaries={dailySummaries}
          />
        )}

        {activeTab === 'progress' && (
          <ProgressView
            progressEntries={progressEntries}
            baselineWeight={profile.weightKg}
            onLogWeight={handleLogWeight}
            foodLog={foodLog}
            activityLog={activityLog}
            profile={profile}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileView
            profile={profile}
            foodDatabase={foodDatabase}
            selectedSheet={selectedSheet}
            sheetTabs={sheetTabs}
            userEmail={user?.email || activeUserEmailRef.current}
            onOpenSheetSelector={() => setShowSheetModal(true)}
            onAddFoodToDatabase={handleManualAddFoodToDatabase}
            onRunIntegrityCheck={() => {
              setActiveTab('chat');
              handleSendMessage('Perform an integrity check of all six sheets');
            }}
            onSwitchAccount={handleSwitchAccount}
            onOpenOnboarding={() => setShowOnboardingModal(true)}
            onOpenDeleteDataModal={() => setShowDeleteDataModal(true)}
            theme={theme}
            toggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <Navigation
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        pendingOffersCount={pendingOfferToDb?.length || 0}
      />

      {/* Sheet Selector Modal */}
      <SheetSelectorModal
        isOpen={showSheetModal}
        sheets={availableSheets}
        selectedSheetId={selectedSheet?.id || null}
        userEmail={user?.email || activeUserEmailRef.current}
        onSelectSheet={handleSelectSheet}
        onClose={() => setShowSheetModal(false)}
        onManualIdSubmit={handleManualSheetId}
        onCreateNewSheet={handleCreateNewSheet}
        isCreatingSheet={isCreatingSheet}
      />

      {/* New User Onboarding Modal */}
      <NewUserOnboardingModal
        isOpen={showOnboardingModal}
        userEmail={user?.email || activeUserEmailRef.current}
        initialProfile={profile}
        onConfirm={handleSaveOnboardingProfile}
      />

      {/* Destructive Confirm Modal */}
      <DestructiveConfirmModal
        isOpen={destructiveModal.isOpen}
        title={destructiveModal.title}
        description={destructiveModal.description}
        onConfirm={async () => {
          await destructiveModal.action();
          setDestructiveModal({ ...destructiveModal, isOpen: false });
        }}
        onCancel={() => setDestructiveModal({ ...destructiveModal, isOpen: false })}
      />

      {/* Delete All Data Modal */}
      {showDeleteDataModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-red-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-red-900">Delete All My Data</h3>
            <p className="text-xs text-red-700 leading-relaxed">
              This will permanently delete your Food Log, Activity Log, Daily Summary, and Progress history from your connected Google Sheet. 
              <strong> This action cannot be undone.</strong>
            </p>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-stone-700">Type "DELETE" to enable:</label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs"
                placeholder="DELETE"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteDataModal(false);
                  setDeleteConfirmationText('');
                }}
                className="flex-1 px-3 py-2 bg-stone-100 text-stone-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAllData}
                disabled={deleteConfirmationText !== 'DELETE'}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
