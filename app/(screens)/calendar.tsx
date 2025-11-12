import { ECHO_COLOR } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Utilise le proxy local pour éviter CORS en développement web
const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? "http://localhost:3001"
  : "https://reseausocial-production.up.railway.app";

interface CalendarEvent {
  id: number;
  titre: string;
  description: string;
  date_debut: string;
  date_fin: string;
  type: 'professionnel' | 'personnel' | 'anniversaire' | 'autre';
  lieu?: string;
  is_all_day: boolean;
  rappel_minutes?: number;
  created_at: string;
  updated_at: string;
}

interface MonthData {
  year: number;
  month: number;
  events: CalendarEvent[];
  total: number;
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']; // Monday -> Sunday (FR)
const THEME = {
  green: ECHO_COLOR,
  greenSoft: '#f6fbf6',
  text: '#375a3b',
  sub: '#6b7c6d',
  card: '#ffffff',
};

// --- Debug helpers ---
const DEBUG_CAL = true;
const log = (...args: any[]) => DEBUG_CAL && console.log('[CAL]', ...args);
const logErr = (...args: any[]) => DEBUG_CAL && console.error('[CAL][ERR]', ...args);

// Format a local date as YYYY-MM-DD (no timezone conversion)
const fmtLocalDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const EVENT_TYPES_COLORS: Record<string, string> = {
  professionnel: '#3a7d44', // deep moss
  personnel: '#5aa469',     // fresh leaf
  anniversaire: '#7fb685',   // soft mint
  autre: '#9bb89f',          // sage gray‑green
};

export default function CalendarScreen() {
  const { makeAuthenticatedRequest } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthData, setMonthData] = useState<MonthData | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [animMonth] = useState(new Animated.Value(0));
  const [isAnimatingMonth, setIsAnimatingMonth] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<CalendarEvent['type']>('autre');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [submitting, setSubmitting] = useState(false);
  const [createdEventIds, setCreatedEventIds] = useState<Set<number>>(new Set());

  // Récupérer les événements du mois
  const fetchMonthEvents = async (date: Date) => {
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const url = `${API_BASE_URL}/calendrier/month/?year=${year}&month=${month}`;
      log('fetchMonthEvents ->', { year, month, url });

      const response = await makeAuthenticatedRequest(url);
      log('fetchMonthEvents response status', response?.status);

      if (!response.ok) {
        const txt = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ${txt}`);
      }

      const raw = await response.json();
      log('fetchMonthEvents raw', raw);

      // Normalize server payload (supports several possible shapes)
      let eventsRaw: any[] = [];
      let normYear = date.getFullYear();
      let normMonth = date.getMonth() + 1;

      if (Array.isArray(raw)) {
        eventsRaw = raw;
      } else if (raw && Array.isArray(raw.events)) {
        eventsRaw = raw.events;
        if (typeof raw.year === 'number') normYear = raw.year;
        if (typeof raw.month === 'number') normMonth = raw.month;
      } else if (raw && Array.isArray(raw.evenements)) {
        eventsRaw = raw.evenements;
        if (typeof raw.annee === 'number') normYear = raw.annee;
        if (typeof raw.mois === 'number') normMonth = raw.mois;
      } else if (raw && raw.evenements_par_jour && typeof raw.evenements_par_jour === 'object') {
        // Shape: { evenements_par_jour: { '13': [ {...}, ... ], ... }, month, year }
        const byDay = raw.evenements_par_jour as Record<string, any[]>;
        if (typeof raw.year === 'number') normYear = raw.year;
        if (typeof raw.month === 'number') normMonth = raw.month;
        const acc: any[] = [];
        Object.entries(byDay).forEach(([dayKey, arr]) => {
          if (!Array.isArray(arr)) return;
          const dayNum = parseInt(dayKey, 10);
          const yyyy = normYear;
          const mm = String(normMonth).padStart(2, '0');
          const dd = String(dayNum).padStart(2, '0');
          arr.forEach((ev) => {
            // If backend omitted full datetime, try to build from day + heure fields
            let dateDebut = ev.date_debut ?? ev.start ?? ev.start_at ?? ev.startDate;
            let dateFin = ev.date_fin ?? ev.end ?? ev.end_at ?? ev.endDate;
            if (!dateDebut && (ev.heure_debut || ev.heureDebut)) {
              const hhmm = (ev.heure_debut || ev.heureDebut).toString().padStart(5, '0');
              dateDebut = `${yyyy}-${mm}-${dd}T${hhmm}:00`;
            }
            if (!dateFin && (ev.heure_fin || ev.heureFin)) {
              const hhmm = (ev.heure_fin || ev.heureFin).toString().padStart(5, '0');
              dateFin = `${yyyy}-${mm}-${dd}T${hhmm}:00`;
            }
            acc.push({
              ...ev,
              date_debut: dateDebut,
              date_fin: dateFin,
              type: ev.type ?? ev.type_evenement ?? 'autre',
            });
          });
        });
        eventsRaw = acc;
      } else if (raw && Array.isArray(raw.results)) {
        eventsRaw = raw.results;
      } else if (raw && raw.data && Array.isArray(raw.data)) {
        eventsRaw = raw.data;
      }

      const events = eventsRaw.map((ev: any) => ({
        id: ev.id,
        titre: ev.titre ?? ev.title ?? '',
        description: ev.description ?? '',
        date_debut: ev.date_debut ?? ev.start ?? ev.start_at ?? ev.startDate,
        date_fin: ev.date_fin ?? ev.end ?? ev.end_at ?? ev.endDate,
        type: ev.type ?? ev.type_evenement ?? 'autre',
        lieu: ev.lieu ?? ev.location,
        is_all_day: Boolean(ev.is_all_day ?? ev.all_day ?? false),
        rappel_minutes: typeof ev.rappel_minutes === 'number' ? ev.rappel_minutes : undefined,
        created_at: ev.created_at ?? ev.date_creation,
        updated_at: ev.updated_at ?? ev.date_modification,
      }));

      log('fetchMonthEvents normalized', { count: events.length, first: events[0] });

      setMonthData({
        year: normYear,
        month: normMonth,
        events,
        total: events.length,
      });
    } catch (error) {
      logErr('Erreur chargement événements du mois:', error);
      setMonthData({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        events: [],
        total: 0,
      });
    }
  };


  // Charger les données initiales
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      log('Initial load for month', { currentMonth: currentMonth.toString() });
      await fetchMonthEvents(currentMonth);
      setLoading(false);
    };
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Rafraîchir les données
  const onRefresh = async () => {
    setRefreshing(true);
    log('Pull-to-refresh for', { month: currentMonth.getMonth() + 1, year: currentMonth.getFullYear() });
    await fetchMonthEvents(currentMonth);
    setRefreshing(false);
  };

  // Animate month transitions
  const changeMonth = async (direction: 'prev' | 'next') => {
    if (isAnimatingMonth) return;
    log('changeMonth', direction);
    setIsAnimatingMonth(true);
    const toValue = direction === 'next' ? -1 : 1; // slide left on next
    animMonth.setValue(0);
    Animated.timing(animMonth, {
      toValue,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(async () => {
      const newMonth = new Date(currentMonth);
      newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
      setCurrentMonth(newMonth);
      log('changeMonth -> new month', newMonth.toString());
      await fetchMonthEvents(newMonth);
      animMonth.setValue(-toValue);
      Animated.timing(animMonth, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setIsAnimatingMonth(false));
    });
  };

  // Sélectionner un jour
  const selectDay = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
  };

  // Générer les jours du calendrier (Monday first)
  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Make Monday the first day: JS getDay() => Sun=0..Sat=6; convert to Mon=0..Sun=6
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7;

    const days: (number | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  // Count events for a day
  const countEventsForDay = (day: number): number => {
    if (!monthData || !monthData.events?.length) return 0;
    const cellDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
      0, 0, 0, 0
    );
    const cellKey = fmtLocalDate(cellDate);
    const count = monthData.events.filter(ev => {
      const evKey = fmtLocalDate(new Date(ev.date_debut));
      return evKey === cellKey;
    }).length;
    log('countEventsForDay', { day, cellKey, count });
    return count;
  };

  // Vérifier si c'est le jour sélectionné
  const isSelectedDay = (day: number): boolean => {
    return (
      day === selectedDate.getDate() &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear()
    );
  };

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const toIsoLocal = (date: Date) => {
    const tzOff = date.getTimezoneOffset() * 60000;
    const localISOTime = new Date(date.getTime() - tzOff).toISOString().slice(0,19);
    return localISOTime; // yyyy-MM-ddTHH:MM:SS
  };
  const mergeDateTime = (d: Date, hhmm: string) => {
    const [hh, mm] = hhmm.split(':').map((x) => parseInt(x || '0', 10));
    const copy = new Date(d);
    copy.setHours(hh || 0, mm || 0, 0, 0);
    return copy;
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Titre requis', 'Veuillez entrer un titre.');
      return;
    }
    setSubmitting(true);
    try {
      const start = mergeDateTime(selectedDate, startTime);
      const end = mergeDateTime(selectedDate, endTime);
      if (end <= start) {
        Alert.alert('Heure invalide', "L'heure de fin doit être après le début.");
        setSubmitting(false);
        return;
      }
      const payload = {
        titre: newTitle.trim(),
        description: '',
        date_debut: toIsoLocal(start),
        date_fin: toIsoLocal(end),
        type: newType,
        is_all_day: false,
      };
      log('handleCreate -> POST /calendrier/events/', payload);
      const resp = await makeAuthenticatedRequest(`${API_BASE_URL}/calendrier/events/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      log('handleCreate response status', resp?.status);
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status} ${txt}`);
      }
      const created = await resp.json();
      log('Event created OK', created);
      setCreatedEventIds(prev => {
        const next = new Set(prev);
        if (typeof created?.id === 'number') next.add(created.id);
        return next;
      });

      setShowCreate(false);
      setNewTitle('');
      setStartTime('09:00');
      setEndTime('10:00');
      await fetchMonthEvents(currentMonth);
      Alert.alert('Événement créé', 'Votre événement a été ajouté.');
    } catch (e: any) {
      logErr('Create event error:', e);
      Alert.alert('Échec de la création', e?.message || 'Réessayez plus tard.');
    } finally {
      setSubmitting(false);
    }
  };


  // Build the month into rows (weeks of 7 days)
  const getWeeks = (days: (number|null)[]) => {
    const weeks: (number|null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }
    return weeks;
  };

  // Memoized calendar computations
  const currentMonthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;
  const calendarDays = useMemo(() => generateCalendarDays(), [currentMonthKey]);
  const weeks = useMemo(() => getWeeks(calendarDays), [calendarDays]);

  // Events for the selected day only
  const eventsThisDay = useMemo(() => {
    if (!monthData?.events) return [] as CalendarEvent[];
    const selectedDateKey = fmtLocalDate(selectedDate);
    const list = monthData.events.filter(ev => {
      const evKey = fmtLocalDate(new Date(ev.date_debut));
      return evKey === selectedDateKey;
    }).sort((a, b) => {
      // Trier par heure de début
      return new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime();
    });
    log('eventsThisDay', { selectedDate: selectedDateKey, count: list.length });
    return list;
  }, [monthData?.events, selectedDate]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ECHO_COLOR} />
          <Text style={styles.loadingText}>Chargement du calendrier...</Text>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header professionnel ultra-clean */}
      <View style={styles.pageHeader}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Calendrier</Text>
            <View style={styles.headerDateContainer}>
              <Ionicons name="calendar-outline" size={16} color={THEME.sub} style={styles.headerDateIcon} />
              <Text style={styles.headerSubtitle}>
                {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => setShowCreate(true)} 
            style={styles.headerAddButton}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* En-tête du mois */}
        <View style={styles.monthHeader}>
          <TouchableOpacity onPress={() => changeMonth('prev')} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color={ECHO_COLOR} />
          </TouchableOpacity>
          
          <Text style={styles.monthTitle}>
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Text>
          
          <TouchableOpacity onPress={() => changeMonth('next')} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color={ECHO_COLOR} />
          </TouchableOpacity>
        </View>

        {/* Jours de la semaine (L à D) */}
        <View style={styles.weekDaysHeader}>
          {WEEKDAYS.map((d, i) => (
            <Text key={i} style={styles.weekDayText}>{d}</Text>
          ))}
        </View>

        {/* Grille + animation slide */}
        <Animated.View
          style={{
            transform: [{ translateX: animMonth.interpolate({ inputRange: [-1, 0, 1], outputRange: [-40, 0, 40] }) }],
          }}
        >
          {weeks.map((week, wIdx) => {
            return (
              <View key={wIdx} style={styles.calendarRow}>
                {week.map((day, index) => {
                  const isToday = day &&
                    day === new Date().getDate() &&
                    currentMonth.getMonth() === new Date().getMonth() &&
                    currentMonth.getFullYear() === new Date().getFullYear();
                  const count = day ? countEventsForDay(day) : 0;
                  const isSelected = !!day && isSelectedDay(day);
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.dayCell, !day ? styles.emptyClay : undefined]}
                      onPress={() => day && selectDay(day)}
                      disabled={!day}
                    >
                      {day && (
                        <>
                          <View style={[
                            styles.dayNumberWrap,
                            isSelected ? styles.dayNumberSelected : undefined,
                            isToday ? styles.dayNumberToday : undefined,
                          ]}>
                            <Text style={[styles.dayText, isSelected && styles.selectedDayText]}>{day}</Text>
                          </View>
                          {count > 0 && (
                            <View style={styles.dotsRow}>
                              {Array.from({ length: Math.min(count, 3) }).map((_, iDot) => (
                                <View key={iDot} style={styles.eventDot} />
                              ))}
                              {count > 3 && <Text style={styles.moreCount}>+{count - 3}</Text>}
                            </View>
                          )}
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </Animated.View>

        {/* Section des événements du jour */}
        <View style={styles.dayEventsSection}>
          <View style={styles.dayEventsSectionHeader}>
            <Text style={styles.dayEventsSectionTitle}>
              {eventsThisDay.length > 0 
                ? `${eventsThisDay.length} événement${eventsThisDay.length > 1 ? 's' : ''}`
                : 'Aucun événement'}
            </Text>
            {eventsThisDay.length > 0 && (
              <Text style={styles.dayEventsSectionSubtitle}>
                {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
            )}
          </View>

          {eventsThisDay.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={64} color="#c0d8c0" />
              <Text style={styles.emptyText}>Aucun événement pour ce jour</Text>
              <TouchableOpacity 
                style={styles.emptyAddButton}
                onPress={() => setShowCreate(true)}
              >
                <Ionicons name="add" size={20} color="white" />
                <Text style={styles.emptyAddButtonText}>Ajouter un événement</Text>
              </TouchableOpacity>
            </View>
          ) : (
            eventsThisDay.map((event, idx) => {
              const start = new Date(event.date_debut);
              const end = new Date(event.date_fin);
              const isNew = !!createdEventIds && typeof event.id === 'number' && createdEventIds.has(event.id);
              
              return (
                <View key={event.id || idx} style={[styles.eventCard, isNew && styles.eventCardNew]}>
                  <View style={[styles.eventTypeIndicator, { backgroundColor: EVENT_TYPES_COLORS[event.type] || '#6a6a6a' }]} />
                  <View style={styles.eventContent}>
                    <View style={styles.eventHeader}>
                      <Text style={styles.eventTitle}>{event.titre}</Text>
                      {isNew && (
                        <View style={styles.newBadge}>
                          <Text style={styles.newBadgeText}>NOUVEAU</Text>
                        </View>
                      )}
                    </View>
                    
                    {event.description && (
                      <Text style={styles.eventDescription} numberOfLines={2}>{event.description}</Text>
                    )}
                    
                    <View style={styles.eventMeta}>
                      {!event.is_all_day && (
                        <View style={styles.eventMetaItem}>
                          <Ionicons name="time-outline" size={14} color={THEME.sub} />
                          <Text style={styles.eventMetaText}>
                            {start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      )}
                      {event.is_all_day && (
                        <View style={styles.eventMetaItem}>
                          <Ionicons name="sunny-outline" size={14} color={THEME.sub} />
                          <Text style={styles.eventMetaText}>Toute la journée</Text>
                        </View>
                      )}
                      {event.lieu && (
                        <View style={styles.eventMetaItem}>
                          <Ionicons name="location-outline" size={14} color={THEME.sub} />
                          <Text style={styles.eventMetaText}>{event.lieu}</Text>
                        </View>
                      )}
                      <View style={styles.eventMetaItem}>
                        <View style={[styles.eventTypeBadge, { backgroundColor: EVENT_TYPES_COLORS[event.type] || '#6a6a6a' }]}>
                          <Text style={styles.eventTypeBadgeText}>
                            {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Modal création d'événement */}
        <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Nouvel événement</Text>

              <Text style={styles.modalLabel}>Titre</Text>
              <TextInput
                style={styles.input}
                placeholder="Titre de l'événement"
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={styles.modalLabel}>Type</Text>
              <View style={styles.typeRow}>
                {(['professionnel','personnel','anniversaire','autre'] as const).map((t) => (
                  <TouchableOpacity key={t} style={[styles.typeChip, newType === t && styles.typeChipActive]} onPress={() => setNewType(t)}>
                    <Text style={[styles.typeChipText, newType === t && styles.typeChipTextActive]}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Heures</Text>
              <View style={styles.timeRow}>
                <TextInput style={[styles.input, styles.timeInput]} keyboardType="numeric" value={startTime} onChangeText={setStartTime} placeholder="HH:MM" />
                <Text style={{ marginHorizontal: 8 }}>→</Text>
                <TextInput style={[styles.input, styles.timeInput]} keyboardType="numeric" value={endTime} onChangeText={setEndTime} placeholder="HH:MM" />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)} disabled={submitting}><Text style={styles.cancelText}>Annuler</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleCreate} disabled={submitting}>
                  <Text style={styles.saveText}>{submitting ? 'Enregistrement…' : 'Créer'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.greenSoft,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
  },
  // Header professionnel ultra-clean
  pageHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  headerDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerDateIcon: {
    marginRight: 6,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  headerAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ECHO_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ECHO_COLOR,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 5,
  },
  addButton: {
    marginRight: 12,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 145, 104, 0.08)',
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  weekDaysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 14,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.04)',
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    letterSpacing: 0.5,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
    paddingBottom: 8,
  },
  calendarRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
  },
  dayCell: {
    width: '14.28%',
    height: 62,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 6,
  },
  dayNumberWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  dayNumberSelected: {
    backgroundColor: ECHO_COLOR,
    shadowColor: ECHO_COLOR,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  dayNumberToday: {
    borderWidth: 2,
    borderColor: ECHO_COLOR,
    backgroundColor: 'rgba(10, 145, 104, 0.08)',
  },
  dayText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
  },
  selectedDayText: {
    color: 'white',
    fontWeight: '700',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 3,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: ECHO_COLOR,
  },
  moreCount: {
    fontSize: 9,
    color: '#9ca3af',
    marginLeft: 2,
    fontWeight: '600',
  },
  // (old filter styles kept harmless if referenced later; safe to remove if unused)
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  filterChip: {
    backgroundColor: THEME.greenSoft,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  filterChipActive: {
    backgroundColor: THEME.green,
  },
  filterChipText: {
    color: THEME.green,
    fontWeight: '700',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  // FAB styles (kept for potential reuse)
  fabCluster: {
    position: 'absolute',
    right: 16,
    bottom: Platform.select({ ios: 24, android: 24 }),
    alignItems: 'center',
    gap: 10,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  fabAdd: { backgroundColor: THEME.green },
  fabToday: { backgroundColor: '#5e35b1', flexDirection: 'row', paddingHorizontal: 10, width: 74 },
  fabTodayText: { color: '#fff', marginLeft: 6, fontWeight: '800' },
  emptyClay: {
    backgroundColor: 'transparent',
  },
  dayEventsSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 100,
    backgroundColor: THEME.greenSoft,
  },
  dayEventsSectionHeader: {
    marginBottom: 20,
  },
  dayEventsSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  dayEventsSectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginTop: 4,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    elevation: 1,
  },
  emptyText: {
    marginTop: 20,
    marginBottom: 28,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ECHO_COLOR,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 8,
    shadowColor: ECHO_COLOR,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 5,
  },
  emptyAddButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  eventCardNew: {
    borderWidth: 2,
    borderColor: '#FFD54F',
    shadowOpacity: 0.12,
  },
  eventTypeIndicator: {
    width: 4,
    borderRadius: 2,
    marginRight: 16,
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginRight: 8,
    letterSpacing: -0.2,
  },
  newBadge: {
    backgroundColor: '#FFD54F',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5d4100',
    letterSpacing: 0.5,
  },
  eventDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 21,
  },
  eventMeta: {
    gap: 10,
  },
  eventMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  eventMetaText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  eventTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  eventTypeBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // Modal création
  modalBackdrop: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'flex-end' 
  },
  modalCard: { 
    backgroundColor: '#fff', 
    padding: 24, 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: { 
    fontSize: 24, 
    fontWeight: '800', 
    marginBottom: 20,
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  modalLabel: { 
    marginTop: 12, 
    marginBottom: 8, 
    color: '#374151', 
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  input: { 
    borderWidth: 1.5, 
    borderColor: '#e5e7eb', 
    borderRadius: 14, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    backgroundColor: '#f9fafb',
    fontSize: 16,
    color: '#1a1a1a',
  },
  timeRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
    gap: 12,
  },
  timeInput: { 
    flex: 1, 
    textAlign: 'center',
    fontWeight: '600',
  },
  modalActions: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    marginTop: 24, 
    gap: 12 
  },
  cancelBtn: { 
    paddingVertical: 14, 
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
  },
  cancelText: { 
    color: '#374151', 
    fontWeight: '700',
    fontSize: 16,
  },
  saveBtn: { 
    backgroundColor: ECHO_COLOR, 
    paddingVertical: 14, 
    paddingHorizontal: 28, 
    borderRadius: 14,
    shadowColor: ECHO_COLOR,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 5,
  },
  saveText: { 
    color: '#fff', 
    fontWeight: '800',
    fontSize: 16,
  },
  typeRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 10 
  },
  typeChip: { 
    backgroundColor: '#f3f4f6', 
    borderRadius: 14, 
    paddingVertical: 10, 
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  typeChipActive: { 
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    borderColor: ECHO_COLOR,
  },
  typeChipText: { 
    color: '#6b7280', 
    fontWeight: '600',
    fontSize: 14,
  },
  typeChipTextActive: { 
    color: ECHO_COLOR,
    fontWeight: '700',
  },
});