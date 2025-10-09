import { ECHO_COLOR } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

  // Récupérer les événements du mois
  const fetchMonthEvents = async (date: Date) => {
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;

      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/calendrier/month/?year=${year}&month=${month}`
      );

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      const data = await response.json();
      // S'assurer que events est toujours un tableau
      setMonthData({
        ...data,
        events: data.events || []
      });
    } catch (error) {
      console.error('Erreur chargement événements du mois:', error);
      // Définir une structure vide en cas d'erreur
      setMonthData({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        events: [],
        total: 0
      });
    }
  };


  // Charger les données initiales
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchMonthEvents(currentMonth);
      setLoading(false);
    };
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Rafraîchir les données
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMonthEvents(currentMonth);
    setRefreshing(false);
  };

  // Animate month transitions
  const changeMonth = async (direction: 'prev' | 'next') => {
    if (isAnimatingMonth) return;
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
    const dateStr = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    ).toISOString().split('T')[0];
    return monthData.events.filter(ev => ev.date_debut.split('T')[0] === dateStr).length;
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
        Alert.alert('Heure invalide', 'L\'heure de fin doit être après le début.');
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
      const resp = await makeAuthenticatedRequest(`${API_BASE_URL}/calendrier/events/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`Erreur ${resp.status}`);
      setShowCreate(false);
      setNewTitle('');
      setStartTime('09:00');
      setEndTime('10:00');
      // refresh month data
      await fetchMonthEvents(currentMonth);
      Alert.alert('Événement créé', 'Votre événement a été ajouté.');
    } catch (e: any) {
      console.error('Create event error:', e);
      Alert.alert("Échec de la création", e?.message || 'Réessayez plus tard.');
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

  const getWeekRange = (date: Date) => {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // Mon=0
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23,59,59,999);
    return { start, end };
  };

  // Memoized calendar computations
  const currentMonthKey = `${currentMonth.getFullYear()}-${currentMonth.getMonth()}`;
  const calendarDays = useMemo(() => generateCalendarDays(), [currentMonthKey]);
  const weeks = useMemo(() => getWeeks(calendarDays), [calendarDays]);
  const { start: selWeekStart, end: selWeekEnd } = useMemo(() => getWeekRange(selectedDate), [selectedDate]);
  const selWeekStartTime = selWeekStart.getTime();
  const selWeekEndTime = selWeekEnd.getTime();

  // Events in the selected week (use month data for speed)
  const eventsThisWeek = useMemo(() => {
    if (!monthData?.events) return [] as CalendarEvent[];
    return monthData.events.filter(ev => {
      const start = new Date(ev.date_debut);
      return start >= selWeekStart && start <= selWeekEnd;
    });
  }, [monthData?.events, selWeekStartTime, selWeekEndTime]);

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
    <SafeAreaView style={styles.container}>
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
            const isSelectedWeek = week.some((d) => typeof d === 'number' && isSelectedDay(d as number));
            return (
              <View key={wIdx}>
                <View style={styles.calendarRow}>
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
                        onLongPress={() => day && console.log('Créer événement le', day)}
                      >
                        {day && (
                          <>
                            <View style={[
                              styles.dayNumberWrap,
                              isSelected ? styles.dayNumberSelected : undefined,
                              isToday ? styles.dayNumberToday : undefined,
                            ]}>
                              {isSelected ? (
                                <TouchableOpacity onPress={() => setShowCreate(true)}>
                                  <Ionicons name="add-circle" size={34} color="white" />
                                </TouchableOpacity>
                              ) : (
                                <Text style={[styles.dayText, isSelected && styles.selectedDayText]}>{day}</Text>
                              )}
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
                {isSelectedWeek && (
                  <WeekAgenda
                    key={`agenda-${wIdx}`}
                    startDate={selWeekStart}
                    events={eventsThisWeek}
                  />
                )}
              </View>
            );
          })}
        </Animated.View>
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

function WeekAgenda({ startDate, events }: { startDate: Date; events: CalendarEvent[] }) {
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return d;
  });

  const slotH = 26; // px per hour (bigger for readability)

  // Build events per day
  const eventsByDay = days.map((d) => {
    const key = d.toISOString().slice(0,10);
    return events.filter((ev) => ev.date_debut.slice(0,10) === key);
  });

  // Scrolling to current time if this week is the current one
  const scrollerRef = useRef<ScrollView>(null);
  useEffect(() => {
    const now = new Date();
    const weekStart = new Date(startDate);
    const weekEnd = new Date(startDate);
    weekEnd.setDate(weekStart.getDate() + 6);
    if (now >= weekStart && now <= weekEnd) {
      const targetY = Math.max(0, (now.getHours() + now.getMinutes() / 60) * slotH - 160);
      scrollerRef.current?.scrollTo({ y: targetY, animated: true });
    }
  }, [startDate]);

  // Helper for day label (Lun 09)
  const dayLabel = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' }).replace('.', '');

  // Current time indicator within each column (only for today)
  const now = new Date();
  const todayIndex = days.findIndex((d) => d.toDateString() === now.toDateString());
  const nowTop = (now.getHours() + now.getMinutes() / 60) * slotH;

  return (
    <View>
      {/* Header for week days */}
      <View style={styles.agendaWeekHeader}>
        <View style={styles.agendaHoursCol} />
        <View style={styles.agendaDaysHeaderRow}>
          {days.map((d, i) => (
            <View key={i} style={styles.agendaDayHeaderCell}>
              <Text style={styles.agendaDayHeaderText}>{dayLabel(d)}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView ref={scrollerRef} style={{ maxHeight: 7 * slotH + 260 }} showsVerticalScrollIndicator={false}>
        <View style={styles.agendaContainer}>
          <View style={styles.agendaHoursCol}>
            {HOURS.map(h => (
              <View key={h} style={[styles.agendaHour, { height: slotH }] }>
                <Text style={styles.agendaHourText}>{h.toString().padStart(2,'0')}h</Text>
              </View>
            ))}
          </View>
          <View style={styles.agendaDaysWrap}>
            {days.map((d, colIdx) => (
              <View key={colIdx} style={styles.agendaDayCol}>
                {/* grid lines */}
                {HOURS.map((h) => (
                  <View key={h} style={[styles.agendaLine, { height: slotH }]} />
                ))}

                {/* red current-time line for today */}
                {todayIndex === colIdx && (
                  <View style={[styles.nowLine, { top: nowTop }]} />
                )}

                {/* events absolute */}
                <View style={StyleSheet.absoluteFillObject}>
                  {eventsByDay[colIdx].map((ev, i) => {
                    const start = new Date(ev.date_debut);
                    const end = new Date(ev.date_fin);
                    const startHour = start.getHours() + start.getMinutes()/60;
                    const endHour = end.getHours() + end.getMinutes()/60;
                    const top = startHour * slotH;
                    const height = Math.max(slotH * (endHour - startHour), 22);
                    return (
                      <View key={i} style={[styles.agendaEvent, { top, height, backgroundColor: EVENT_TYPES_COLORS[ev.type] || '#6a6a6a' }]}> 
                        <Text style={styles.agendaEventTitle} numberOfLines={1}>{ev.titre}</Text>
                        {!ev.is_all_day && (
                          <Text style={styles.agendaEventTime} numberOfLines={1}>
                            {start.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} – {end.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
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
  addButton: {
    marginRight: 12,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: THEME.card,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  navButton: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: THEME.text,
  },
  weekDaysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    backgroundColor: THEME.card,
    borderBottomWidth: 1,
    borderBottomColor: '#e6eee6',
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: THEME.sub,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: THEME.card,
    paddingBottom: 16,
    paddingTop: 8,
  },
  calendarRow: {
    flexDirection: 'row',
    backgroundColor: THEME.card,
  },
  dayCell: {
    width: '14.28%',
    height: 56,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 4,
  },
  dayNumberWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6eee6',
  },
  dayNumberSelected: {
    backgroundColor: ECHO_COLOR,
  },
  dayNumberToday: {
    borderWidth: 1.5,
    borderColor: ECHO_COLOR,
    borderRadius: 17,
  },
  dayText: {
    fontSize: 14,
    color: THEME.text,
    fontWeight: '700',
  },
  selectedDayText: {
    color: 'white',
    fontWeight: '700',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 2,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: ECHO_COLOR,
  },
  moreCount: {
    fontSize: 10,
    color: THEME.sub,
    marginLeft: 2,
    fontWeight: '700',
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
    padding: 16,
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
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: THEME.sub,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  eventTypeIndicator: {
    width: 4,
    borderRadius: 2,
    marginRight: 12,
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.text,
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 14,
    color: THEME.sub,
    marginBottom: 8,
  },
  eventMeta: {
    gap: 8,
  },
  eventMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventMetaText: {
    fontSize: 12,
    color: THEME.sub,
  },
  // Week agenda styles
  agendaContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6eee6',
  },
  agendaHoursCol: {
    width: 48,
    backgroundColor: '#f9fcf9',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#e6eee6',
  },
  agendaHour: { justifyContent: 'flex-start', paddingTop: 2, paddingHorizontal: 6 },
  agendaHourText: { fontSize: 10, color: '#7a7a7a' },
  agendaDaysWrap: { flex: 1, flexDirection: 'row' },
  agendaDayCol: { flex: 1, position: 'relative' },
  agendaLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eef5ef' },
  agendaEvent: {
    position: 'absolute',
    left: 4,
    right: 4,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  agendaEventTitle: { color: 'white', fontSize: 12, fontWeight: '700' },
  agendaEventTime: { color: 'white', fontSize: 10, opacity: 0.9 },
  // Modal création
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  modalLabel: { marginTop: 8, marginBottom: 6, color: '#555', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fafafa' },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeInput: { flex: 1, textAlign: 'center' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, gap: 10 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 12 },
  cancelText: { color: '#666', fontWeight: '700' },
  saveBtn: { backgroundColor: ECHO_COLOR, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  saveText: { color: '#fff', fontWeight: '800' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { backgroundColor: THEME.greenSoft, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  typeChipActive: { backgroundColor: THEME.green },
  typeChipText: { color: THEME.green, fontWeight: '700' },
  typeChipTextActive: { color: '#fff' },
  agendaWeekHeader: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#e6eee6' },
  agendaDaysHeaderRow: { flex: 1, flexDirection: 'row' },
  agendaDayHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8e8e8' },
  agendaDayHeaderText: { fontSize: 12, fontWeight: '700', color: '#2e2e2e' },
  nowLine: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: ECHO_COLOR },
});