import { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput,
  StyleSheet, Platform, StatusBar, ScrollView, Image,
} from 'react-native';
import { Trip, useTripStore } from '../store/tripStore';
import { useBookDimensions } from '../hooks/useBookDimensions';
import CardEditor   from './CardEditor';
import ParisCard    from './cards/ParisCard';
import KyotoCard    from './cards/KyotoCard';
import BaliCard     from './cards/BaliCard';
import MoroccoCard  from './cards/MoroccoCard';
import LisbonCard   from './cards/LisbonCard';

type Section = 'itinerary' | 'ootd' | 'budget' | 'hotel' | 'flight';

interface Props {
  trip: Trip | null;
  index: number | null;
  visible: boolean;
  onClose: () => void;
}

// ─────────────────────────────────────────────
// Shared detail header
// ─────────────────────────────────────────────
function DetailHeader({ onBack }: { onBack: () => void }) {
  return (
    <TouchableOpacity style={styles.detailBackBtn} onPress={onBack} hitSlop={12}>
      <Text style={styles.detailBackText}>← overview</Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────
// Itinerary detail
// ─────────────────────────────────────────────
function ItineraryDetail({ trip, onBack }: { trip: Trip; onBack: () => void }) {
  const { updateTrip } = useTripStore();
  const [activeDay, setActiveDay] = useState(0);
  const [newItem, setNewItem]     = useState('');

  const itinerary = trip.itinerary ?? [[], [], []];

  function addItem() {
    const text = newItem.trim();
    if (!text) return;
    const updated = itinerary.map((day, i) =>
      i === activeDay ? [...day, text] : [...day]
    );
    updateTrip(trip.id, { itinerary: updated });
    setNewItem('');
  }

  function removeItem(dayIdx: number, itemIdx: number) {
    const updated = itinerary.map((day, i) =>
      i === dayIdx ? day.filter((_, j) => j !== itemIdx) : [...day]
    );
    updateTrip(trip.id, { itinerary: updated });
  }

  function addDay() {
    const updated = [...itinerary, []];
    updateTrip(trip.id, { itinerary: updated });
    setActiveDay(updated.length - 1);
  }

  return (
    <View style={styles.detailRoot}>
      <StatusBar barStyle="dark-content" />
      <DetailHeader onBack={onBack} />
      <ScrollView
        contentContainerStyle={styles.detailScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.mLabel}>DAY BY DAY</Text>
        <Text style={styles.detailTitle}>Itinerary</Text>

        <View style={styles.dayPills}>
          {itinerary.map((_, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.dayPill, activeDay === i && styles.dayPillActive]}
              onPress={() => setActiveDay(i)}
            >
              <Text style={[styles.dayPillText, activeDay === i && styles.dayPillTextActive]}>
                Day {i + 1}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.dayPillAdd} onPress={addDay}>
            <Text style={styles.dayPillAddText}>+ day</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.itineraryList}>
          {(itinerary[activeDay] ?? []).length === 0 ? (
            <Text style={styles.emptyHint}>No activities yet for Day {activeDay + 1}.</Text>
          ) : (
            (itinerary[activeDay] ?? []).map((item, i) => (
              <View key={i} style={styles.itineraryRow}>
                <Text style={styles.itineraryBullet}>·</Text>
                <Text style={styles.itineraryItemText}>{item}</Text>
                <TouchableOpacity onPress={() => removeItem(activeDay, i)} hitSlop={10}>
                  <Text style={styles.itineraryDelete}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={newItem}
            onChangeText={setNewItem}
            placeholder="Add an activity…"
            placeholderTextColor="#ccc"
            returnKeyType="done"
            onSubmitEditing={addItem}
          />
          <TouchableOpacity style={styles.addBtn} onPress={addItem}>
            <Text style={styles.addBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// OOTD detail
// ─────────────────────────────────────────────
function OOTDDetail({ trip, onBack, onEdit }: { trip: Trip; onBack: () => void; onEdit: () => void }) {
  const imageEls = trip.elements.filter((e) => e.type === 'image');

  return (
    <View style={styles.detailRoot}>
      <StatusBar barStyle="dark-content" />
      <DetailHeader onBack={onBack} />
      <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.mLabel}>TODAY'S LOOK</Text>
        <Text style={[styles.detailTitle, { fontFamily: 'BebasNeue', letterSpacing: 1 }]}>OOTD</Text>

        {imageEls.length > 0 ? (
          <View style={styles.ootdGrid}>
            {imageEls.map((el) => (
              <Image
                key={el.id}
                source={{ uri: el.uri! }}
                style={styles.ootdGridImg}
                resizeMode="cover"
              />
            ))}
          </View>
        ) : (
          <View style={styles.ootdEmpty}>
            <Text style={styles.ootdEmptyIcon}>👕</Text>
            <Text style={styles.ootdEmptyText}>
              Add outfit photos via the Stickers section
            </Text>
            <TouchableOpacity style={styles.editOutlineBtn} onPress={onEdit}>
              <Text style={styles.editOutlineBtnText}>open stickers</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// Budget detail
// ─────────────────────────────────────────────
function BudgetDetail({ trip, onBack, onEdit }: { trip: Trip; onBack: () => void; onEdit: () => void }) {
  const spentPct = trip.budgetTotal && trip.budgetTotal > 0
    ? Math.min((trip.budgetSpent ?? 0) / trip.budgetTotal, 1)
    : 0;
  const budgetLeft = trip.budgetTotal != null
    ? trip.budgetTotal - (trip.budgetSpent ?? 0)
    : null;

  return (
    <View style={styles.detailRoot}>
      <StatusBar barStyle="dark-content" />
      <DetailHeader onBack={onBack} />
      <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.mLabel}>SPENDING</Text>
        <Text style={styles.detailTitle}>Budget</Text>

        {trip.budgetTotal != null ? (
          <>
            <Text style={styles.budgetBigAmount}>
              ${(trip.budgetSpent ?? 0).toLocaleString()}
              <Text style={styles.budgetBigAmountSub}> spent</Text>
            </Text>
            <Text style={styles.budgetOf}>of ${trip.budgetTotal.toLocaleString()} total</Text>

            <View style={styles.progressRow}>
              <View style={{ flex: spentPct, height: 4, backgroundColor: '#1a1a1a', borderRadius: 2 }} />
              <View style={{ flex: Math.max(1 - spentPct, 0), height: 4, backgroundColor: '#e4e1dc', borderRadius: 2 }} />
            </View>

            {budgetLeft != null && (
              <Text style={styles.budgetLeftBig}>${budgetLeft.toLocaleString()} left</Text>
            )}
          </>
        ) : (
          <Text style={styles.emptyHint}>No budget set yet.</Text>
        )}

        <TouchableOpacity style={[styles.editOutlineBtn, { marginTop: 32 }]} onPress={onEdit}>
          <Text style={styles.editOutlineBtnText}>edit budget</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// Hotel detail
// ─────────────────────────────────────────────
function HotelDetail({ trip, onBack, onEdit }: { trip: Trip; onBack: () => void; onEdit: () => void }) {
  return (
    <View style={styles.detailRoot}>
      <StatusBar barStyle="dark-content" />
      <DetailHeader onBack={onBack} />
      <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.mLabel}>
          {[
            trip.hotelLocation?.toUpperCase(),
            trip.hotelNights ? `${trip.hotelNights} NIGHTS` : null,
          ].filter(Boolean).join(' · ') || 'ACCOMMODATION'}
        </Text>
        <Text style={styles.detailTitle}>Hotel</Text>

        {(trip.hotelLocation || trip.hotelNights) ? (
          <View style={styles.hotelDetailCard}>
            <View style={styles.hotelDetailRow}>
              <Text style={styles.hotelDetailLabel}>Location</Text>
              <Text style={styles.hotelDetailValue}>{trip.hotelLocation ?? '—'}</Text>
            </View>
            <View style={styles.hotelDetailDivider} />
            <View style={styles.hotelDetailRow}>
              <Text style={styles.hotelDetailLabel}>Nights</Text>
              <Text style={styles.hotelDetailValue}>{trip.hotelNights ?? '—'}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.emptyHint}>No hotel added yet.</Text>
        )}

        <TouchableOpacity style={[styles.editOutlineBtn, { marginTop: 32 }]} onPress={onEdit}>
          <Text style={styles.editOutlineBtnText}>edit hotel</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// Flight detail
// ─────────────────────────────────────────────
function FlightDetail({ trip, onBack, onEdit }: { trip: Trip; onBack: () => void; onEdit: () => void }) {
  const hasData = trip.flightFrom || trip.flightTo || trip.flightDate || trip.flightNumber;

  return (
    <View style={styles.detailRoot}>
      <StatusBar barStyle="dark-content" />
      <DetailHeader onBack={onBack} />
      <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.mLabel}>FLIGHTS</Text>
        <Text style={styles.detailTitle}>Flight</Text>

        {hasData ? (
          <>
            <View style={styles.flightRouteRow}>
              <Text style={styles.flightCity}>{trip.flightFrom ?? '—'}</Text>
              <Text style={styles.flightArrow}>→</Text>
              <Text style={styles.flightCity}>{trip.flightTo ?? '—'}</Text>
            </View>

            <View style={styles.hotelDetailCard}>
              {trip.flightDate && (
                <>
                  <View style={styles.hotelDetailRow}>
                    <Text style={styles.hotelDetailLabel}>Date</Text>
                    <Text style={styles.hotelDetailValue}>{trip.flightDate}</Text>
                  </View>
                  <View style={styles.hotelDetailDivider} />
                </>
              )}
              {trip.flightNumber && (
                <View style={styles.hotelDetailRow}>
                  <Text style={styles.hotelDetailLabel}>Flight</Text>
                  <Text style={styles.hotelDetailValue}>{trip.flightNumber}</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <Text style={styles.emptyHint}>No flight added yet.</Text>
        )}

        <TouchableOpacity style={[styles.editOutlineBtn, { marginTop: 32 }]} onPress={onEdit}>
          <Text style={styles.editOutlineBtnText}>edit flight</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// Main overview content
// ─────────────────────────────────────────────
const CARDS = [ParisCard, KyotoCard, BaliCard, MoroccoCard, LisbonCard];

function OverviewContent({
  trip,
  index,
  onClose,
  onSection,
  onEdit,
}: {
  trip: Trip;
  index: number | null;
  onClose: () => void;
  onSection: (s: Section) => void;
  onEdit: () => void;
}) {
  const [activeDay, setActiveDay] = useState(0);
  const { isTablet } = useBookDimensions();

  const displayName = trip.customName    ?? trip.name;
  const displayCtry = trip.customCountry ?? trip.country;
  const imageEls    = trip.elements.filter((e) => e.type === 'image');
  const numDays     = trip.itinerary?.length ?? 3;
  const spentPct    = trip.budgetTotal && trip.budgetTotal > 0
    ? Math.min((trip.budgetSpent ?? 0) / trip.budgetTotal, 1)
    : 0;
  const budgetLeft  = trip.budgetTotal != null
    ? trip.budgetTotal - (trip.budgetSpent ?? 0)
    : null;
  const hasHotel    = !!(trip.hotelLocation || trip.hotelNights);
  const hasFlight   = !!(trip.flightFrom || trip.flightTo || trip.flightDate);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      <TouchableOpacity style={styles.backBtn} onPress={onClose} hitSlop={12}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[styles.scroll, isTablet && styles.scrollTablet]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.card}>
          <View style={styles.heroRow}>
            <View style={styles.heroLeft}>
              <Text style={styles.mLabel}>{displayCtry.toUpperCase()}</Text>
              <Text style={[styles.heroCity, { fontFamily: trip.titleFont }]}>
                {displayName}
              </Text>
              {trip.dateRange ? (
                <Text style={styles.heroDate}>{trip.dateRange}</Text>
              ) : null}
              {trip.daysAway ? (
                <View style={styles.daysAwayPill}>
                  <View style={styles.daysAwayDot} />
                  <Text style={styles.daysAwayText}>{trip.daysAway}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.polaroidStack}>
              {imageEls.length > 0 ? (
                <>
                  <View style={[styles.polaroid, styles.polaroidBack]}>
                    <Image
                      source={{ uri: imageEls[1]?.uri ?? imageEls[0].uri! }}
                      style={styles.polaroidImg}
                      resizeMode="cover"
                    />
                    <Text style={styles.polaroidCaption} numberOfLines={1}>
                      {trip.dateRange?.split('–').pop()?.trim() ?? displayName.toLowerCase()}
                    </Text>
                  </View>
                  <View style={styles.polaroid}>
                    <Image
                      source={{ uri: imageEls[0].uri! }}
                      style={styles.polaroidImg}
                      resizeMode="cover"
                    />
                    <Text style={styles.polaroidCaption} numberOfLines={1}>
                      {displayName.toLowerCase()}
                    </Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={[styles.polaroid, styles.polaroidBack, styles.polaroidEmpty]} />
                  <View style={[styles.polaroid, styles.polaroidEmpty]} />
                </>
              )}
            </View>
          </View>
        </View>

        {/* ── Itinerary ── */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => onSection('itinerary')}
          activeOpacity={0.85}
        >
          <Text style={styles.mLabel}>DAY BY DAY</Text>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Itinerary</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
          <View style={styles.dayPills}>
            {Array.from({ length: numDays }, (_, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.dayPill, activeDay === i && styles.dayPillActive]}
                onPress={(e) => { e.stopPropagation(); setActiveDay(i); }}
              >
                <Text style={[styles.dayPillText, activeDay === i && styles.dayPillTextActive]}>
                  Day {i + 1}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {trip.itinerary?.[activeDay]?.length ? (
            <View style={{ marginTop: 8, gap: 2 }}>
              {trip.itinerary[activeDay].slice(0, 2).map((item, i) => (
                <Text key={i} style={styles.itineraryPreviewItem}>· {item}</Text>
              ))}
              {trip.itinerary[activeDay].length > 2 && (
                <Text style={styles.emptyHint}>+{trip.itinerary[activeDay].length - 2} more</Text>
              )}
            </View>
          ) : (
            <Text style={styles.emptyHint}>Tap to add plans day by day.</Text>
          )}
        </TouchableOpacity>

        {/* ── OOTD + Budget ── */}
        <View style={styles.halfRow}>
          <TouchableOpacity
            style={[styles.card, styles.halfCard]}
            onPress={() => onSection('ootd')}
            activeOpacity={0.85}
          >
            <Text style={styles.mLabel}>TODAY'S LOOK</Text>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, styles.ootdTitle]}>OOTD</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
            <View style={styles.ootdIcons}>
              <Text style={styles.ootdIcon}>👕</Text>
              <Text style={styles.ootdIcon}>👓</Text>
              <Text style={styles.ootdIcon}>👜</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.card, styles.halfCard]}
            onPress={() => onSection('budget')}
            activeOpacity={0.85}
          >
            <Text style={styles.mLabel}>SPENDING</Text>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Budget</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
            <Text style={styles.budgetAmount}>
              {trip.budgetSpent != null ? `$${trip.budgetSpent.toLocaleString()}` : '—'}
            </Text>
            {trip.budgetTotal != null && (
              <Text style={styles.budgetOf}>of ${trip.budgetTotal.toLocaleString()}</Text>
            )}
            {trip.budgetTotal != null && trip.budgetTotal > 0 && (
              <View style={styles.progressRow}>
                <View style={{ flex: spentPct, height: 3, backgroundColor: '#1a1a1a', borderRadius: 2 }} />
                <View style={{ flex: Math.max(1 - spentPct, 0), height: 3, backgroundColor: '#e4e1dc', borderRadius: 2 }} />
              </View>
            )}
            {budgetLeft != null && (
              <Text style={styles.budgetLeft}>${budgetLeft.toLocaleString()} left</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Hotel ── */}
        <TouchableOpacity
          style={[styles.card, styles.hotelCard]}
          onPress={() => onSection('hotel')}
          activeOpacity={0.85}
        >
          <View>
            <Text style={styles.mLabel}>
              {hasHotel
                ? [trip.hotelLocation?.toUpperCase(), trip.hotelNights ? `${trip.hotelNights} NIGHTS` : null].filter(Boolean).join(' · ')
                : 'ACCOMMODATION'}
            </Text>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Hotel</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
            {!hasHotel && <Text style={styles.emptyHint}>Tap to add hotel details.</Text>}
          </View>
          <View style={styles.hotelPhoto} />
        </TouchableOpacity>

        {/* ── Flight ── */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => onSection('flight')}
          activeOpacity={0.85}
        >
          <Text style={styles.mLabel}>FLIGHTS</Text>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Flight</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
          {hasFlight ? (
            <Text style={styles.flightPreview}>
              {trip.flightFrom ?? '—'} → {trip.flightTo ?? '—'}
              {trip.flightDate ? `  ·  ${trip.flightDate}` : ''}
            </Text>
          ) : (
            <Text style={styles.emptyHint}>Tap to add flight details.</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        style={[styles.editFab, isTablet && styles.editFabTablet]}
        onPress={onEdit}
        activeOpacity={0.8}
      >
        <Text style={styles.editFabText}>edit card</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────
export default function TripOverview({ trip, index, visible, onClose }: Props) {
  const [showEdit, setShowEdit]       = useState(false);
  const [activeSection, setSection]   = useState<Section | null>(null);

  if (!trip) return null;

  const detailProps = { trip, onBack: () => setSection(null), onEdit: () => setShowEdit(true) };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      {activeSection === 'itinerary' ? (
        <ItineraryDetail trip={trip} onBack={() => setSection(null)} />
      ) : activeSection === 'ootd' ? (
        <OOTDDetail {...detailProps} />
      ) : activeSection === 'budget' ? (
        <BudgetDetail {...detailProps} />
      ) : activeSection === 'hotel' ? (
        <HotelDetail {...detailProps} />
      ) : activeSection === 'flight' ? (
        <FlightDetail {...detailProps} />
      ) : (
        <OverviewContent
          trip={trip}
          index={index}
          onClose={onClose}
          onSection={setSection}
          onEdit={() => setShowEdit(true)}
        />
      )}

      <CardEditor
        trip={trip}
        visible={showEdit}
        onClose={() => setShowEdit(false)}
      />
    </Modal>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Overview layout ──
  root: { flex: 1, backgroundColor: '#f7f5f2' },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 28,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  backArrow: { fontFamily: 'DMSans-Regular', fontSize: 22, color: '#1a1a1a' },
  scroll: {
    paddingTop: Platform.OS === 'ios' ? 100 : 72,
    paddingHorizontal: 16,
    paddingBottom: 100,
    gap: 12,
  },
  scrollTablet: { paddingHorizontal: 48 },

  // ── Card shell ──
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 8,
    padding: 20,
  },

  // ── Shared label / title ──
  mLabel: {
    fontFamily: 'DMSans-Medium',
    fontSize: 8,
    letterSpacing: 2,
    color: '#c4a472',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: 'PlayfairDisplay-BoldItalic',
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: '#1a1a1a',
    marginBottom: 12,
  },
  ootdTitle: { fontFamily: 'BebasNeue', letterSpacing: 1 },
  chevron: { fontFamily: 'DMSans-Regular', fontSize: 22, color: '#ccc', marginBottom: 12 },
  emptyHint: {
    fontFamily: 'DMSans-Regular', fontSize: 11, color: '#ccc', marginTop: 4,
  },

  // ── Hero ──
  heroRow: { flexDirection: 'row', alignItems: 'flex-start' },
  heroLeft: { flex: 1, paddingRight: 8 },
  heroCity: { fontSize: 52, lineHeight: 48, letterSpacing: -1.5, color: '#1a1a1a', marginBottom: 8 },
  heroDate: {
    fontFamily: 'CormorantGaramond-LightItalic',
    fontSize: 16, color: '#666', marginBottom: 10,
  },
  daysAwayPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    borderWidth: 1, borderColor: '#91040C', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5, gap: 6,
  },
  daysAwayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#91040C' },
  daysAwayText: {
    fontFamily: 'DMSans-Regular', fontSize: 11, color: '#91040C', letterSpacing: 0.3,
  },

  // ── Polaroids ──
  polaroidStack: { width: 130, height: 150 },
  polaroid: {
    position: 'absolute', width: 82, height: 104,
    backgroundColor: '#111', padding: 5, paddingBottom: 22,
    left: 5, top: 28, transform: [{ rotate: '-4deg' }], zIndex: 2,
  },
  polaroidBack: {
    left: undefined, right: 0, top: 4,
    transform: [{ rotate: '9deg' }], zIndex: 1,
  },
  polaroidImg: { flex: 1, backgroundColor: '#333' },
  polaroidCaption: {
    position: 'absolute', bottom: 4, left: 5, right: 5,
    textAlign: 'center',
    fontFamily: 'CormorantGaramond-LightItalic',
    fontSize: 8, color: '#bbb', letterSpacing: 0.5,
  },
  polaroidEmpty: { backgroundColor: '#d8d5d0' },

  // ── Day pills ──
  dayPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayPill: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: '#ccc', borderRadius: 20,
  },
  dayPillActive: { borderColor: '#91040C', backgroundColor: 'rgba(145,4,12,0.04)' },
  dayPillText: { fontFamily: 'DMSans-Regular', fontSize: 11, color: '#aaa' },
  dayPillTextActive: { color: '#91040C', fontFamily: 'DMSans-Medium' },
  dayPillAdd: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 20, borderStyle: 'dashed',
  },
  dayPillAddText: { fontFamily: 'DMSans-Regular', fontSize: 11, color: '#ccc' },

  // ── Itinerary preview ──
  itineraryPreviewItem: {
    fontFamily: 'DMSans-Regular', fontSize: 12, color: '#444', lineHeight: 20,
  },

  // ── Half row (OOTD + Budget) ──
  halfRow: { flexDirection: 'row', gap: 12 },
  halfCard: { flex: 1, padding: 16 },

  // ── OOTD ──
  ootdIcons: { flexDirection: 'row', gap: 6 },
  ootdIcon:  { fontSize: 26 },

  // ── Budget ──
  budgetAmount: {
    fontFamily: 'PlayfairDisplay-Bold', fontSize: 26, letterSpacing: -0.5,
    color: '#1a1a1a', marginTop: 2,
  },
  budgetOf: {
    fontFamily: 'DMSans-Regular', fontSize: 10, color: '#aaa', marginTop: 2, marginBottom: 6,
  },
  progressRow: { flexDirection: 'row', marginBottom: 6 },
  budgetLeft: {
    fontFamily: 'CormorantGaramond-LightItalic', fontSize: 14, color: '#91040C',
  },

  // ── Hotel ──
  hotelCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hotelPhoto: { width: 88, height: 88, borderRadius: 4, backgroundColor: '#e4e1dc' },

  // ── Flight ──
  flightPreview: {
    fontFamily: 'CormorantGaramond-LightItalic', fontSize: 16, color: '#555',
  },

  // ── Edit FAB ──
  editFab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    left: 16, right: 16,
    paddingVertical: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    alignItems: 'center',
  },
  editFabTablet: { left: 48, right: 48 },
  editFabText: {
    fontFamily: 'DMSans-Regular', fontSize: 10, letterSpacing: 2.5,
    color: '#fff', textTransform: 'uppercase',
  },

  // ── Detail screens ──
  detailRoot: { flex: 1, backgroundColor: '#f7f5f2' },
  detailBackBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 28,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  detailBackText: {
    fontFamily: 'DMSans-Regular', fontSize: 13, color: '#1a1a1a', letterSpacing: 0.3,
  },
  detailScroll: {
    paddingTop: Platform.OS === 'ios' ? 110 : 84,
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  detailTitle: {
    fontFamily: 'PlayfairDisplay-BoldItalic',
    fontSize: 42, lineHeight: 44, letterSpacing: -1,
    color: '#1a1a1a', marginBottom: 20,
  },

  // Itinerary detail
  itineraryList: { gap: 4, marginTop: 16 },
  itineraryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  itineraryBullet: { fontFamily: 'DMSans-Regular', fontSize: 16, color: '#ccc' },
  itineraryItemText: { flex: 1, fontFamily: 'DMSans-Regular', fontSize: 13, color: '#333' },
  itineraryDelete: { fontFamily: 'DMSans-Regular', fontSize: 11, color: '#ccc' },
  addRow: {
    flexDirection: 'row', gap: 10, marginTop: 20,
    borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 16,
  },
  addInput: {
    flex: 1,
    fontFamily: 'DMSans-Regular', fontSize: 14, color: '#1a1a1a',
    borderBottomWidth: 1, borderBottomColor: '#e8e8e8', paddingVertical: 4,
  },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 20, lineHeight: 22 },

  // OOTD detail
  ootdGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  ootdGridImg: { width: 100, height: 100, borderRadius: 4 },
  ootdEmpty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  ootdEmptyIcon: { fontSize: 48 },
  ootdEmptyText: {
    fontFamily: 'DMSans-Regular', fontSize: 13, color: '#aaa',
    textAlign: 'center', maxWidth: 220,
  },

  // Budget detail
  budgetBigAmount: {
    fontFamily: 'PlayfairDisplay-Bold', fontSize: 52, letterSpacing: -1.5, color: '#1a1a1a',
  },
  budgetBigAmountSub: {
    fontFamily: 'DMSans-Regular', fontSize: 16, color: '#aaa', letterSpacing: 0,
  },
  budgetLeftBig: {
    fontFamily: 'CormorantGaramond-LightItalic', fontSize: 22, color: '#91040C', marginTop: 4,
  },

  // Hotel / shared detail card
  hotelDetailCard: {
    borderWidth: 1, borderColor: '#e8e8e8', borderRadius: 6,
    padding: 16, marginTop: 8, gap: 0,
  },
  hotelDetailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 10,
  },
  hotelDetailDivider: { height: 1, backgroundColor: '#f0f0f0' },
  hotelDetailLabel: {
    fontFamily: 'DMSans-Medium', fontSize: 10, letterSpacing: 1.5,
    color: '#bbb', textTransform: 'uppercase',
  },
  hotelDetailValue: {
    fontFamily: 'PlayfairDisplay-Regular', fontSize: 15, color: '#1a1a1a',
  },

  // Flight detail
  flightRouteRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 20, marginTop: 8,
  },
  flightCity: {
    fontFamily: 'PlayfairDisplay-Bold', fontSize: 36, letterSpacing: -1, color: '#1a1a1a',
  },
  flightArrow: { fontFamily: 'DMSans-Regular', fontSize: 20, color: '#ccc' },

  // Shared action button
  editOutlineBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10, paddingHorizontal: 24,
    borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 2,
  },
  editOutlineBtnText: {
    fontFamily: 'DMSans-Regular', fontSize: 9, letterSpacing: 2,
    color: '#1a1a1a', textTransform: 'uppercase',
  },
});
