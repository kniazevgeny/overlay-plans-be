/**
 * Translations for the Telegram bot
 */

// Define supported languages
export type SupportedLanguage = 'en' | 'fr' | 'ru';

// Interface for translations
interface TranslationKeys {
  // General messages
  welcomeMessage: string;
  languageSet: string;
  selectProject: string;
  projectNotFound: string;

  // Time slot related
  noTimeSlotsIdentified: string;
  availableSlotExample: string;
  noTimeSlotApprove: string;
  projectOrUserNotFound: string;
  errorProcessingMessage: string;
  errorProcessingVoice: string;
  errorAddingTimeSlots: string;
  cannotTranscribe: string;
  transcriptionHeard: string;

  // Available and busy slots
  foundAvailableSlots: string;
  foundBusySlots: string;
  foundBothTypes: string;
  busySlotNote: string;
  addAvailableSlots: string;
  registerBusySlots: string;

  // Buttons and actions
  approveAll: string;
  rejectAll: string;
  viewProject: string;
  backToProject: string;
  slotsAddedSuccess: string;
  slotsRejected: string;

  // New keys for slots locking and user assignment
  approveAndLock: string;
  slotsAddedAndLocked: string;
  slotsAddedForUser: string;
  creatingFor: string;
  lockTimeSlot: string;
  unlockTimeSlot: string;
  slotIsLocked: string;
  slotIsUnlocked: string;
  cannotEditLockedSlot: string;

  // User search related translations
  userSearchHelp: string;
  noUsersFound: string;
  usersFoundTitle: string;
  createTimeslotsFor: string;
  errorSearchingUsers: string;
  userNotFound: string;
  createTimeslotsInstructions: string;

  // Project display
  project: string;
  description: string;
  existingTimeslots: string;
  timeslots: string;
  unknown: string;
  noTimeslots: string;
  createdBy: string;
  sendAvailabilityInstructions: string;
  openMiniApp: string;
  editTimeslots: string;
  backToProjects: string;
  noProjectSelected: string;
  editTimeslotsInApp: string;

  // Add new translation keys for slot type editing
  slotType: string;
  changeSlotType: string;
  slotTypeChanged: string;
  availableSlot: string;
  busySlot: string;
  toggleToAvailable: string;
  toggleToBusy: string;
}

// Define translations for each language
const translations: Record<SupportedLanguage, TranslationKeys> = {
  en: {
    // General messages
    welcomeMessage:
      'Welcome to Overlay Plans! This bot helps you manage your plans and schedules. Please select your preferred language:',
    languageSet: "Language set to English. Now let's get started!",
    selectProject:
      'Please select a project first to process your availability.',
    projectNotFound: 'Project not found. Please select another project.',

    // Time slot related
    noTimeSlotsIdentified:
      "I couldn't identify any specific time slots in your message. Please try to be more specific, for example: 'I'm available tomorrow from 2 PM to 4 PM' or 'I can meet on Monday between 10 AM and 12 PM'.",
    availableSlotExample: "I'm available tomorrow from 2 PM to 4 PM",
    noTimeSlotApprove: 'No time slots found to approve.',
    projectOrUserNotFound: 'Project or user not found. Please try again.',
    errorProcessingMessage:
      'Sorry, I encountered an error processing your message. Please try again.',
    errorProcessingVoice:
      'Sorry, I encountered an error processing your voice message. Please try again or send a text message.',
    errorAddingTimeSlots:
      'Sorry, I encountered an error adding time slots to your schedule. Please try again.',
    cannotTranscribe:
      'Sorry, I could not transcribe your voice message. Please try again or send a text message.',
    transcriptionHeard: 'I heard: "{0}"',

    // Available and busy slots
    foundAvailableSlots:
      'I found the following available time slots in your message:\n\n{0}\n\nWould you like to add these to your schedule?',
    foundBusySlots:
      "I found times when you are busy:\n\n{0}\n\nWould you like me to register these as times when you're NOT available?",
    foundBothTypes:
      'I found both available and busy time slots in your message:\n\n{0}\n\n',
    busySlotNote:
      'Note: {0} busy slot(s) will NOT be added to your available schedule.\n\n',
    addAvailableSlots:
      'Would you like to add the {0} available time slot(s) to your schedule?',
    registerBusySlots:
      "Would you like to register these as times when you're NOT available?",

    // Buttons and actions
    approveAll: 'Approve All',
    rejectAll: 'Reject All',
    viewProject: 'View Project',
    backToProject: 'Back to Project',
    slotsAddedSuccess: '✅ Added {0} time slot(s) to your schedule.',
    slotsRejected:
      'Time slots rejected. No changes were made to your schedule.',

    // New keys for slots locking and user assignment
    approveAndLock: 'Approve & Lock',
    slotsAddedAndLocked:
      '🔒 Added {0} time slot(s) to your schedule and locked them.',
    slotsAddedForUser: "✅ Added {0} time slot(s) to {1}'s schedule.",
    creatingFor: 'Creating time slots for',
    lockTimeSlot: 'Lock Time Slot',
    unlockTimeSlot: 'Unlock Time Slot',
    slotIsLocked:
      'This time slot is locked and can only be edited by its creator.',
    slotIsUnlocked: 'This time slot is now unlocked.',
    cannotEditLockedSlot:
      'You cannot edit this time slot as it is locked by its creator.',

    // User search related translations
    userSearchHelp:
      'Please provide a search term after the command, like "/find John" or "/search project manager".',
    noUsersFound: 'No users found matching: {0}',
    usersFoundTitle: 'Found {0} user(s) matching: {1}',
    createTimeslotsFor: 'Create Time Slots for {0}',
    errorSearchingUsers: 'Error searching for users. Please try again.',
    userNotFound: 'User not found. Please try again.',
    createTimeslotsInstructions:
      'Now you can create time slots for {0}. Simply type or send a voice message with availability information.',

    // Project display
    project: 'Project',
    description: 'Description',
    existingTimeslots: 'Existing time slots',
    timeslots: 'time slots',
    unknown: 'Unknown User',
    noTimeslots: 'No time slots scheduled yet.',
    createdBy: 'created by',
    sendAvailabilityInstructions:
      "You can send text or voice messages about your availability. I'll process them to update your schedule.",
    openMiniApp: 'Open Mini App',
    editTimeslots: 'Edit Time Slots',
    backToProjects: 'Back to Projects',
    noProjectSelected:
      'No project is currently selected. Please choose a project first.',
    editTimeslotsInApp: 'You can edit your time slots in the mini app:',

    // Add new translation keys for slot type editing
    slotType: 'Slot Type',
    changeSlotType: 'Change Slot Type',
    slotTypeChanged: 'Slot type changed',
    availableSlot: 'Available Slot',
    busySlot: 'Busy Slot',
    toggleToAvailable: 'Toggle to Available',
    toggleToBusy: 'Toggle to Busy',
  },

  fr: {
    // General messages
    welcomeMessage:
      'Bienvenue sur Overlay Plans ! Ce bot vous aide à gérer vos plans et horaires. Veuillez sélectionner votre langue préférée :',
    languageSet: 'Langue définie sur Français. Commençons !',
    selectProject:
      "Veuillez d'abord sélectionner un projet pour traiter votre disponibilité.",
    projectNotFound:
      'Projet introuvable. Veuillez sélectionner un autre projet.',

    // Time slot related
    noTimeSlotsIdentified:
      "Je n'ai pas pu identifier de créneaux horaires spécifiques dans votre message. Essayez d'être plus précis, par exemple : 'Je suis disponible demain de 14h à 16h' ou 'Je peux me réunir lundi entre 10h et 12h'.",
    availableSlotExample: 'Je suis disponible demain de 14h à 16h',
    noTimeSlotApprove: 'Aucun créneau horaire trouvé à approuver.',
    projectOrUserNotFound:
      'Projet ou utilisateur introuvable. Veuillez réessayer.',
    errorProcessingMessage:
      "Désolé, j'ai rencontré une erreur lors du traitement de votre message. Veuillez réessayer.",
    errorProcessingVoice:
      "Désolé, j'ai rencontré une erreur lors du traitement de votre message vocal. Veuillez réessayer ou envoyer un message texte.",
    errorAddingTimeSlots:
      "Désolé, j'ai rencontré une erreur en ajoutant des créneaux horaires à votre emploi du temps. Veuillez réessayer.",
    cannotTranscribe:
      "Désolé, je n'ai pas pu transcrire votre message vocal. Veuillez réessayer ou envoyer un message texte.",
    transcriptionHeard: 'J\'ai entendu : "{0}"',

    // Available and busy slots
    foundAvailableSlots:
      "J'ai trouvé les créneaux de disponibilité suivants dans votre message :\n\n{0}\n\nVoulez-vous les ajouter à votre emploi du temps ?",
    foundBusySlots:
      "J'ai trouvé des moments où vous êtes occupé :\n\n{0}\n\nVoulez-vous que je les enregistre comme périodes où vous n'êtes PAS disponible ?",
    foundBothTypes:
      "J'ai trouvé à la fois des créneaux disponibles et occupés dans votre message :\n\n{0}\n\n",
    busySlotNote:
      'Remarque : {0} créneau(x) occupé(s) ne seront PAS ajoutés à votre calendrier de disponibilité.\n\n',
    addAvailableSlots:
      'Voulez-vous ajouter les {0} créneau(x) disponible(s) à votre emploi du temps ?',
    registerBusySlots:
      "Voulez-vous enregistrer ces périodes comme moments où vous n'êtes PAS disponible ?",

    // Buttons and actions
    approveAll: 'Tout Approuver',
    rejectAll: 'Tout Rejeter',
    viewProject: 'Voir le Projet',
    backToProject: 'Retour au Projet',
    slotsAddedSuccess:
      '✅ Ajout de {0} créneau(x) horaire(s) à votre emploi du temps.',
    slotsRejected:
      "Créneaux horaires rejetés. Aucune modification n'a été apportée à votre emploi du temps.",

    // New keys for slots locking and user assignment
    approveAndLock: 'Approuver & Verrouiller',
    slotsAddedAndLocked:
      '🔒 Ajout de {0} créneau(x) horaire(s) à votre emploi du temps et verrouillés.',
    slotsAddedForUser:
      "✅ Ajout de {0} créneau(x) horaire(s) à l'emploi du temps de {1}.",
    creatingFor: 'Création de créneaux horaires pour',
    lockTimeSlot: 'Verrouiller le Créneau',
    unlockTimeSlot: 'Déverrouiller le Créneau',
    slotIsLocked:
      'Ce créneau horaire est verrouillé et ne peut être modifié que par son créateur.',
    slotIsUnlocked: 'Ce créneau horaire est maintenant déverrouillé.',
    cannotEditLockedSlot:
      'Vous ne pouvez pas modifier ce créneau horaire car il est verrouillé par son créateur.',

    // User search related translations
    userSearchHelp:
      'Veuillez fournir un terme de recherche après la commande, comme "/find John" ou "/search chef de projet".',
    noUsersFound: 'Aucun utilisateur trouvé correspondant à : {0}',
    usersFoundTitle: 'Trouvé {0} utilisateur(s) correspondant à : {1}',
    createTimeslotsFor: 'Créer des créneaux horaires pour {0}',
    errorSearchingUsers:
      "Erreur lors de la recherche d'utilisateurs. Veuillez réessayer.",
    userNotFound: 'Utilisateur non trouvé. Veuillez réessayer.',
    createTimeslotsInstructions:
      'Vous pouvez maintenant créer des créneaux horaires pour {0}. Tapez simplement ou envoyez un message vocal avec les informations de disponibilité.',

    // Project display
    project: 'Projet',
    description: 'Description',
    existingTimeslots: 'Créneaux horaires existants',
    timeslots: 'créneaux horaires',
    unknown: 'Utilisateur Inconnu',
    noTimeslots: 'Aucun créneau horaire programmé pour le moment.',
    createdBy: 'créé par',
    sendAvailabilityInstructions:
      'Vous pouvez envoyer des messages texte ou vocaux concernant votre disponibilité. Je les traiterai pour mettre à jour votre emploi du temps.',
    openMiniApp: 'Ouvrir Mini App',
    editTimeslots: 'Modifier les Créneaux',
    backToProjects: 'Retour aux Projets',
    noProjectSelected:
      "Aucun projet n'est actuellement sélectionné. Veuillez d'abord choisir un projet.",
    editTimeslotsInApp:
      'Vous pouvez modifier vos créneaux horaires dans la mini application :',

    // Add new translation keys for slot type editing
    slotType: 'Type de Créneau',
    changeSlotType: 'Changer le Type de Créneau',
    slotTypeChanged: 'Type de créneau changé',
    availableSlot: 'Créneau Disponible',
    busySlot: 'Créneau Occupé',
    toggleToAvailable: 'Basculer en Disponible',
    toggleToBusy: 'Basculer en Occupé',
  },

  ru: {
    // General messages
    welcomeMessage:
      'Добро пожаловать в Overlay Plans! Этот бот поможет вам управлять вашими планами и расписаниями. Пожалуйста, выберите предпочитаемый язык:',
    languageSet: 'Язык установлен на Русский. Давайте начнем!',
    selectProject:
      'Пожалуйста, сначала выберите проект для обработки вашей доступности.',
    projectNotFound: 'Проект не найден. Пожалуйста, выберите другой проект.',

    // Time slot related
    noTimeSlotsIdentified:
      "Я не смог определить конкретные временные интервалы в вашем сообщении. Пожалуйста, попробуйте быть более конкретным, например: 'Я свободен завтра с 14:00 до 16:00' или 'Я могу встретиться в понедельник между 10:00 и 12:00'.",
    availableSlotExample: 'Я свободен завтра с 14:00 до 16:00',
    noTimeSlotApprove: 'Не найдено временных интервалов для утверждения.',
    projectOrUserNotFound:
      'Проект или пользователь не найден. Пожалуйста, попробуйте еще раз.',
    errorProcessingMessage:
      'Извините, произошла ошибка при обработке вашего сообщения. Пожалуйста, попробуйте еще раз.',
    errorProcessingVoice:
      'Извините, произошла ошибка при обработке вашего голосового сообщения. Пожалуйста, попробуйте еще раз или отправьте текстовое сообщение.',
    errorAddingTimeSlots:
      'Извините, произошла ошибка при добавлении временных интервалов в ваше расписание. Пожалуйста, попробуйте еще раз.',
    cannotTranscribe:
      'Извините, я не смог расшифровать ваше голосовое сообщение. Пожалуйста, попробуйте еще раз или отправьте текстовое сообщение.',
    transcriptionHeard: 'Я услышал: "{0}"',

    // Available and busy slots
    foundAvailableSlots:
      'Я нашел следующие доступные временные интервалы в вашем сообщении:\n\n{0}\n\nХотите добавить их в ваше расписание?',
    foundBusySlots:
      'Я нашел время, когда вы заняты:\n\n{0}\n\nХотите, чтобы я зарегистрировал эти периоды как время, когда вы НЕ доступны?',
    foundBothTypes:
      'Я нашел как доступные, так и занятые временные интервалы в вашем сообщении:\n\n{0}\n\n',
    busySlotNote:
      'Примечание: {0} занятых интервала(ов) НЕ будут добавлены в ваше расписание доступности.\n\n',
    addAvailableSlots:
      'Хотите добавить {0} доступных временных интервала(ов) в ваше расписание?',
    registerBusySlots:
      'Хотите зарегистрировать эти периоды как время, когда вы НЕ доступны?',

    // Buttons and actions
    approveAll: 'Подтвердить Все',
    rejectAll: 'Отклонить Все',
    viewProject: 'Просмотр Проекта',
    backToProject: 'Назад к Проекту',
    slotsAddedSuccess:
      '✅ Добавлено {0} временных интервалов в ваше расписание.',
    slotsRejected:
      'Временные интервалы отклонены. Никаких изменений в вашем расписании не сделано.',

    // New keys for slots locking and user assignment
    approveAndLock: 'Подтвердить и Заблокировать',
    slotsAddedAndLocked:
      '🔒 Добавлено {0} временных интервалов в ваше расписание и заблокировано.',
    slotsAddedForUser:
      '✅ Добавлено {0} временных интервалов в расписание пользователя {1}.',
    creatingFor: 'Создание временных интервалов для',
    lockTimeSlot: 'Заблокировать Интервал',
    unlockTimeSlot: 'Разблокировать Интервал',
    slotIsLocked:
      'Этот временной интервал заблокирован и может быть изменен только его создателем.',
    slotIsUnlocked: 'Этот временной интервал теперь разблокирован.',
    cannotEditLockedSlot:
      'Вы не можете редактировать этот временной интервал, так как он заблокирован его создателем.',

    // User search related translations
    userSearchHelp:
      'Пожалуйста, укажите поисковой запрос после команды, например "/find Иван" или "/search менеджер проекта".',
    noUsersFound: 'Не найдено пользователей, соответствующих запросу: {0}',
    usersFoundTitle:
      'Найдено {0} пользователя(ей), соответствующих запросу: {1}',
    createTimeslotsFor: 'Создать Временные Интервалы для {0}',
    errorSearchingUsers:
      'Ошибка при поиске пользователей. Пожалуйста, попробуйте еще раз.',
    userNotFound: 'Пользователь не найден. Пожалуйста, попробуйте еще раз.',
    createTimeslotsInstructions:
      'Теперь вы можете создать временные интервалы для {0}. Просто напишите или отправьте голосовое сообщение с информацией о доступности.',

    // Project display
    project: 'Проект',
    description: 'Описание',
    existingTimeslots: 'Существующие временные интервалы',
    timeslots: 'временные интервалы',
    unknown: 'Неизвестный Пользователь',
    noTimeslots: 'Пока нет запланированных временных интервалов.',
    createdBy: 'создано пользователем',
    sendAvailabilityInstructions:
      'Вы можете отправлять текстовые или голосовые сообщения о своей доступности. Я обработаю их для обновления вашего расписания.',
    openMiniApp: 'Открыть Мини-приложение',
    editTimeslots: 'Редактировать Интервалы',
    backToProjects: 'Назад к Проектам',
    noProjectSelected:
      'В настоящее время проект не выбран. Пожалуйста, сначала выберите проект.',
    editTimeslotsInApp:
      'Вы можете редактировать свои временные интервалы в мини-приложении:',

    // Add new translation keys for slot type editing
    slotType: 'Тип Интервала',
    changeSlotType: 'Изменить Тип Интервала',
    slotTypeChanged: 'Тип интервала изменен',
    availableSlot: 'Доступный Интервал',
    busySlot: 'Занятый Интервал',
    toggleToAvailable: 'Переключить в Доступный',
    toggleToBusy: 'Переключить в Занятый',
  },
};

/**
 * Get a translated message for the given language and key
 * @param language The language to use for translation
 * @param key The translation key
 * @param args Optional arguments to replace placeholders in the translation
 * @returns The translated message
 */
export function translate(
  language: string,
  key: keyof TranslationKeys,
  ...args: string[]
): string {
  // Default to English if language not supported
  const lang =
    language && translations[language as SupportedLanguage]
      ? (language as SupportedLanguage)
      : 'en';

  let message = translations[lang][key];

  // Replace placeholders {0}, {1}, etc. with provided arguments
  args.forEach((arg, index) => {
    message = message.replace(`{${index}}`, arg);
  });

  return message;
}
