import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
  Vibration,
} from 'react-native';
import DraggableTile from './src/DraggableTile';
import { getLevel } from './src/levels.mjs';
import {
  createAttempt,
  findTilePosition,
  getScaleDifference,
  getSideValue,
  isStructurallyStable,
  markHintUsed,
  placeTile,
  restartAttempt,
  returnTile,
  undo,
} from './src/game.mjs';
import { scoreAttempt, starsForAttempt, updateLevelRecord } from './src/scoring.mjs';
import { getReports, loadSlot, resetSlot, saveReport, saveSlot } from './src/storage';

const COLORS = {
  ink: '#25324A',
  muted: '#64738A',
  background: '#F6F4EF',
  card: '#FFFFFF',
  coral: '#F06449',
  yellow: '#FFE08A',
  blue: '#CDEDF1',
  green: '#C9E9CB',
  border: '#E4E2DC',
};
const TUTORIALS = {
  1: 'Drag a number onto any open slot. Place weights on both sides until their totals match.',
  3: 'Each placement or move counts. Undo never adds a move, so experiment freely.',
  4: 'This plus sign is fixed. Build an expression around it with the number tiles.',
  7: 'Operators are tiles now. Put numbers and operators in the order you want.',
  8: 'Fractions and decimals can mean the same value. The scale compares them exactly.',
  9: 'Use each parenthesis tile separately. Keep the two sides within one tile of each other.',
};
const DEFAULT_SETTINGS = {
  showMoveCounter: true,
  soundEffects: true,
  music: true,
  haptics: true,
  largeText: false,
  highContrast: false,
};

function emptySave() {
  return {
    version: 1,
    currentLevel: 1,
    unlockedLevels: 1,
    totalScore: 0,
    records: {},
    currentAttempt: null,
    settings: { ...DEFAULT_SETTINGS },
    tutorialsSeen: [],
    lastPlayed: null,
  };
}

function Button({ children, onPress, variant = 'primary', disabled = false, small = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        styles[`button_${variant}`],
        small && styles.smallButton,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.buttonText, styles[`buttonText_${variant}`], small && styles.smallButtonText]}>
        {children}
      </Text>
    </Pressable>
  );
}

function Heading({ children, large = false, style }) {
  return <Text style={[styles.heading, large && styles.largeHeading, style]}>{children}</Text>;
}

function ToggleRow({ label, value, onValueChange }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#D9D9D4', true: '#A8D9D0' }}
        thumbColor={value ? '#248B7A' : '#F6F4EF'}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function App() {
  const [slots, setSlots] = useState({ 1: null, 2: null, 3: null });
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState('home');
  const [selectedSlot, setSelectedSlot] = useState(1);
  const [slotIntent, setSlotIntent] = useState('continue');
  const [attempt, setAttempt] = useState(null);
  const [selectedTile, setSelectedTile] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [hintContent, setHintContent] = useState(null);
  const [revealedHintSide, setRevealedHintSide] = useState(null);
  const [settingsReturn, setSettingsReturn] = useState('home');
  const [storageError, setStorageError] = useState('');
  const slotRefs = useRef([[], []]);

  const save = slots[selectedSlot] ?? emptySave();
  const level = useMemo(() => getLevel(save.currentLevel), [save.currentLevel]);
  const showCounter = save.settings.showMoveCounter && level.id >= 3;
  const displayScale = save.settings.largeText ? 1.15 : 1;
  const scaleDifference = attempt ? getScaleDifference(attempt, level) : null;
  const tilt = scaleDifference
    ? Math.max(-7, Math.min(7, (Number(scaleDifference.numerator) / Number(scaleDifference.denominator)) * 1.5))
    : 0;
  const occupiedIds = attempt ? attempt.slots.flat().filter(Boolean) : [];
  const inventory = level.tiles.filter(
    (tile) => !level.fixed.some((item) => item.id === tile.id) && !occupiedIds.includes(tile.id),
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const values = await Promise.all([1, 2, 3].map((id) => loadSlot(id)));
        if (active) setSlots({ 1: values[0], 2: values[1], 3: values[2] });
      } catch {
        if (active) setStorageError('Local save storage is unavailable. Progress may not persist.');
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (screen !== 'play' || !attempt || modal || attempt.complete || attempt.failed) return undefined;
    const timer = setInterval(() => {
      setAttempt((previous) => {
        if (!previous || previous.complete || previous.failed) return previous;
        const next = { ...previous, elapsedSeconds: previous.elapsedSeconds + 1 };
        if (next.elapsedSeconds % 5 === 0) {
          persistSave({ ...save, currentAttempt: next, lastPlayed: Date.now() });
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [screen, modal, attempt?.complete, attempt?.failed, selectedSlot, save]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  function persistSave(data) {
    setSlots((previous) => ({ ...previous, [selectedSlot]: data }));
    saveSlot(selectedSlot, data).catch(() => {
      setStorageError('Could not write your save. Check device storage and try again.');
    });
  }

  function openSlots(intent) {
    setSlotIntent(intent);
    setScreen('slots');
  }

  function startNewSlot(slotId) {
    setSelectedSlot(slotId);
    setSlots((previous) => ({ ...previous, [slotId]: emptySave() }));
    setModal(null);
    resetSlot(slotId).catch(() => setStorageError('Could not reset this save slot.'));
    const fresh = emptySave();
    saveSlot(slotId, fresh).catch(() => setStorageError('Could not create this save slot.'));
    enterGame(slotId, fresh, 1);
  }

  function enterGame(slotId, data, levelId) {
    const chosenLevel = getLevel(levelId);
    const currentAttempt = data.currentLevel === levelId && data.currentAttempt
      ? data.currentAttempt
      : createAttempt(chosenLevel);
    setSelectedSlot(slotId);
    setAttempt(currentAttempt);
    setSelectedTile(null);
    setScreen('play');
    setModal(null);
    const updated = { ...data, currentLevel: levelId, currentAttempt, lastPlayed: Date.now() };
    setSlots((previous) => ({ ...previous, [slotId]: updated }));
    saveSlot(slotId, updated).catch(() => setStorageError('Could not save your game.'));
    if (TUTORIALS[levelId] && !data.tutorialsSeen.includes(levelId)) {
      setModal('tutorial');
    }
  }

  function selectSlotAction(slotId, action) {
    setSelectedSlot(slotId);
    const data = slots[slotId];
    if (action === 'new') {
      if (data) {
        setModal('resetConfirm');
      } else {
        startNewSlot(slotId);
      }
    } else if (data) {
      enterGame(slotId, data, data.currentLevel);
    } else {
      startNewSlot(slotId);
    }
  }

  function beginLevel(levelId) {
    const current = slots[selectedSlot] ?? emptySave();
    const data = {
      ...current,
      currentLevel: levelId,
      currentAttempt: createAttempt(getLevel(levelId)),
      lastPlayed: Date.now(),
    };
    setAttempt(data.currentAttempt);
    setSelectedTile(null);
    setModal(null);
    setScreen('play');
    persistSave(data);
    if (TUTORIALS[levelId] && !data.tutorialsSeen.includes(levelId)) setModal('tutorial');
  }

  function markTutorialSeen() {
    const current = slots[selectedSlot] ?? emptySave();
    const tutorialsSeen = [...new Set([...current.tutorialsSeen, level.id])];
    persistSave({ ...current, tutorialsSeen });
    setModal(null);
  }

  function vibrate() {
    if (save.settings.haptics) Vibration.vibrate(12);
  }

  function finishAttempt(completed) {
    const current = slots[selectedSlot] ?? emptySave();
    const previousRecord = current.records[level.id] ?? {};
    const stars = starsForAttempt({
      hintsUsed: completed.hintsUsed,
      moves: completed.moves,
      moveThreshold: level.moveThreshold,
    });
    const record = updateLevelRecord(previousRecord, completed, level.moveThreshold);
    const data = {
      ...current,
      currentAttempt: completed,
      records: { ...current.records, [level.id]: { ...record, lastStars: stars } },
      totalScore: current.totalScore + scoreAttempt(completed),
      unlockedLevels: Math.max(current.unlockedLevels, Math.min(10, level.id + 1)),
      lastPlayed: Date.now(),
    };
    persistSave(data);
    setModal('complete');
    vibrate();
  }

  function applyAttemptResult(result) {
    if (result.error && result.error !== 'The scale became unstable.') {
      setToast(result.error);
      return;
    }
    setAttempt(result.state);
    setSelectedTile(null);
    const data = { ...save, currentAttempt: result.state, lastPlayed: Date.now() };
    persistSave(data);
    vibrate();
    if (result.error === 'The scale became unstable.') {
      setModal('failure');
    } else if (result.state.complete && !attempt.complete) {
      finishAttempt(result.state);
    }
  }

  function placeSelected(side, index) {
    if (!selectedTile) return;
    applyAttemptResult(placeTile(attempt, level, selectedTile, side, index));
  }

  async function dropTile(tileId, x, y) {
    let target = null;
    const checks = [];
    for (let side = 0; side < 2; side += 1) {
      for (let index = 0; index < 5; index += 1) {
        const ref = slotRefs.current[side]?.[index];
        if (ref) checks.push(new Promise((resolve) => ref.measureInWindow(
          (left, top, width, height) => resolve({ side, index, left, top, width, height }),
        )));
      }
    }
    const boxes = await Promise.all(checks);
    target = boxes.find((box) => (
      x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height
    ));
    if (target) {
      applyAttemptResult(placeTile(attempt, level, tileId, target.side, target.index));
      return;
    }
    const position = findTilePosition(attempt, tileId);
    if (position) applyAttemptResult(returnTile(attempt, level, tileId));
    else setSelectedTile(null);
  }

  function requestHint() {
    if (attempt.hintsUsed >= 3) {
      setToast('You have used all three hints for this attempt.');
      return;
    }
    setModal('hintWarning');
  }

  function confirmHint() {
    const updatedAttempt = markHintUsed(attempt);
    setAttempt(updatedAttempt);
    persistSave({ ...save, currentAttempt: updatedAttempt });
    const hintNumber = updatedAttempt.hintsUsed;
    if (hintNumber === 1) {
      setHintContent({ kind: 'positions' });
      setModal('hint');
    } else if (hintNumber === 2) {
      setModal('hintSide');
    } else {
      const side = revealedHintSide === null ? 0 : 1 - revealedHintSide;
      setHintContent({ kind: 'expression', side });
      setModal('hint');
    }
  }

  function revealExpression(side) {
    setRevealedHintSide(side);
    setHintContent({ kind: 'expression', side });
    setModal('hint');
  }

  function formatHintExpression(side) {
    const tileById = new Map(level.tiles.map((tile) => [tile.id, tile]));
    return level.solution[side].map((id) => tileById.get(id)?.label ?? '?').join('  ');
  }

  async function submitReport(category) {
    const report = {
      levelId: level.id,
      configuration: level.tiles.map(({ id, kind, value }) => ({ id, kind, value })),
      currentTilePositions: attempt.slots,
      attemptedSolution: attempt.slots.map((side) => side.filter(Boolean)),
      category,
      appVersion: '1.0.0',
      reportedAt: new Date().toISOString(),
    };
    try {
      await saveReport(report);
      setModal('reportSaved');
    } catch {
      setToast('Could not save the report on this device.');
    }
  }

  async function exportReports() {
    try {
      const reports = await getReports();
      await Share.share({ message: JSON.stringify(reports, null, 2), title: 'Balance puzzle reports' });
    } catch {
      setToast('Could not export puzzle reports.');
    }
  }

  function openSettings(from = screen) {
    setSettingsReturn(from);
    setModal(null);
    setScreen('settings');
  }

  function updateSetting(key, value) {
    const current = slots[selectedSlot] ?? emptySave();
    const data = { ...current, settings: { ...current.settings, [key]: value } };
    persistSave(data);
  }

  function finishSettings() {
    setScreen(settingsReturn);
    setModal(settingsReturn === 'failure' ? 'failure' : settingsReturn === 'play' ? 'pause' : null);
  }

  function visibleValue(side) {
    const value = getSideValue(attempt, level, side);
    return value ? value.toDecimal(3) : '—';
  }

  function renderTile(tile, compact = false) {
    return (
      <DraggableTile
        key={tile.id}
        tile={tile}
        compact={compact}
        selected={selectedTile === tile.id}
        onSelect={(id) => setSelectedTile((previous) => previous === id ? null : id)}
        onDrop={dropTile}
      />
    );
  }

  function renderBoardSide(side) {
    return (
      <View style={styles.sideCard}>
        <Text style={styles.sideTitle}>{side === 0 ? 'LEFT' : 'RIGHT'}</Text>
        <Text style={[styles.total, { fontSize: 24 * displayScale }]}>{visibleValue(side)}</Text>
        <View style={styles.slotRow}>
          {attempt.slots[side].map((tileId, index) => {
            const tile = tileId ? level.tiles.find((item) => item.id === tileId) : null;
            const fixed = tileId && level.fixed.some((item) => item.id === tileId);
            return (
              <Pressable
                key={`${side}-${index}`}
                ref={(ref) => { slotRefs.current[side][index] = ref; }}
                onPress={() => {
                  if (selectedTile) placeSelected(side, index);
                  else if (tile && !fixed) applyAttemptResult(returnTile(attempt, level, tile.id));
                }}
                accessibilityRole="button"
                accessibilityLabel={`${side === 0 ? 'Left' : 'Right'} slot ${index + 1}${tile ? `, ${tile.label}` : ', empty'}`}
                style={[
                  styles.slot,
                  tile && styles.filledSlot,
                  selectedTile && !tile && styles.targetSlot,
                ]}
              >
                {tile
                  ? fixed
                    ? <View style={styles.fixedTile}><Text style={styles.fixedTileText}>{tile.label}</Text></View>
                    : renderTile(tile, true)
                  : <Text style={styles.slotNumber}>{index + 1}</Text>}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  function renderModal() {
    if (!modal) return null;
    let title = '';
    let body = null;
    let actions = null;

    if (modal === 'pause') {
      title = 'Paused';
      body = <Text style={styles.modalBody}>Take a breath. Your puzzle and timer are safely paused.</Text>;
      actions = (
        <>
          <Button onPress={() => setModal(null)}>Resume</Button>
          <Button variant="secondary" onPress={() => openSettings('play')}>Settings</Button>
          <Button variant="secondary" onPress={() => setModal('restartConfirm')}>Restart level</Button>
          <Button variant="secondary" onPress={() => { setModal(null); setScreen('home'); }}>Return to start</Button>
          <Button variant="quiet" onPress={requestHint}>Give me a hint</Button>
        </>
      );
    } else if (modal === 'restartConfirm') {
      title = 'Restart this level?';
      body = <Text style={styles.modalBody}>Your tiles and move count will reset. Hint use remains recorded for this attempt.</Text>;
      actions = (
        <>
          <Button onPress={() => {
            const restarted = restartAttempt(level, attempt);
            setAttempt(restarted);
            persistSave({ ...save, currentAttempt: restarted });
            setModal(null);
          }}>Restart level</Button>
          <Button variant="secondary" onPress={() => setModal('pause')}>Keep playing</Button>
        </>
      );
    } else if (modal === 'failure') {
      title = 'The scale tipped!';
      body = <Text style={styles.modalBody}>Too many tiles were placed on one side. This attempt has ended.</Text>;
      actions = (
        <>
          <Button onPress={() => {
            const retry = restartAttempt(level, attempt);
            setAttempt(retry);
            persistSave({ ...save, currentAttempt: retry });
            setModal(null);
          }}>Try again</Button>
          <Button variant="secondary" onPress={() => { setModal(null); setScreen('home'); }}>Return to start</Button>
          <Button variant="secondary" onPress={() => openSettings('failure')}>Settings</Button>
        </>
      );
    } else if (modal === 'hintWarning') {
      title = 'A little help?';
      body = <Text style={styles.modalBody}>Warning: Using a hint will reduce the number of stars attainable for this level.</Text>;
      actions = (
        <>
          <Button onPress={confirmHint}>Reveal hint</Button>
          <Button variant="secondary" onPress={() => setModal('pause')}>Not now</Button>
        </>
      );
    } else if (modal === 'hintSide') {
      title = 'Choose a side';
      body = <Text style={styles.modalBody}>Which intended expression would you like to reveal?</Text>;
      actions = (
        <>
          <Button onPress={() => revealExpression(0)}>Show left side</Button>
          <Button onPress={() => revealExpression(1)}>Show right side</Button>
        </>
      );
    } else if (modal === 'hint') {
      title = hintContent?.kind === 'positions' ? 'Answer positions' : `Hint: ${hintContent?.side === 0 ? 'left' : 'right'} side`;
      if (hintContent?.kind === 'positions') {
      const location = (side) => {
        const positions = level.solution[side].map((_, index) => `slot ${index + 1}`);
        return positions.join(', ');
        };
        body = (
          <View style={styles.hintBox}>
            <Text style={styles.modalBody}>Left: {location(0)}</Text>
            <Text style={styles.modalBody}>Right: {location(1)}</Text>
          </View>
        );
      } else {
        body = <Text style={styles.hintExpression}>{formatHintExpression(hintContent?.side ?? 0)}</Text>;
      }
      actions = <Button onPress={() => setModal('pause')}>Got it</Button>;
    } else if (modal === 'complete') {
      const record = save.records[level.id] ?? {};
      const stars = record.lastStars ?? 1;
      title = 'Beautifully balanced!';
      body = (
        <View style={styles.resultCard}>
          <Text style={styles.stars}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</Text>
          <Text style={styles.resultLine}>+{scoreAttempt(attempt)} points</Text>
          <Text style={styles.resultLine}>{attempt.moves} moves · {formatTime(attempt.elapsedSeconds)}</Text>
          <Text style={styles.resultLine}>Best: {record.bestMoves} moves · {formatTime(record.fastestTime)}</Text>
          {level.id < 10 && <Text style={styles.resultLine}>Level {level.id + 1} unlocked!</Text>}
        </View>
      );
      actions = (
        <>
          <Button onPress={() => beginLevel(level.id)}>Replay level</Button>
          {level.id < 10
            ? <Button variant="secondary" onPress={() => beginLevel(level.id + 1)}>Next level</Button>
            : <Button variant="secondary" onPress={() => { setModal(null); setScreen('home'); }}>Back to start</Button>}
        </>
      );
    } else if (modal === 'tutorial') {
      title = `Level ${level.id} · ${level.title}`;
      body = <Text style={styles.modalBody}>{TUTORIALS[level.id]}</Text>;
      actions = <Button onPress={markTutorialSeen}>Let’s play</Button>;
    } else if (modal === 'resetConfirm') {
      title = 'Start over?';
      body = <Text style={styles.modalBody}>This will erase all progress in save slot {selectedSlot}. This cannot be undone.</Text>;
      actions = (
        <>
          <Button onPress={() => startNewSlot(selectedSlot)}>Reset slot</Button>
          <Button variant="secondary" onPress={() => setModal(null)}>Cancel</Button>
        </>
      );
    } else if (modal === 'report') {
      title = 'Report this puzzle';
      body = <Text style={styles.modalBody}>Your current layout and level details stay on this device. Choose what needs a look.</Text>;
      actions = (
        <>
          {['Unsolvable', 'Incomplete', 'Other issue'].map((category) => (
            <Button key={category} variant="secondary" onPress={() => submitReport(category)}>{category}</Button>
          ))}
          <Button variant="quiet" onPress={exportReports}>Export saved reports</Button>
          <Button variant="quiet" onPress={() => setModal(null)}>Cancel</Button>
        </>
      );
    } else if (modal === 'reportSaved') {
      title = 'Report saved';
      body = <Text style={styles.modalBody}>Thanks for helping us improve Balance. The report is stored locally and includes this puzzle layout.</Text>;
      actions = (
        <>
          <Button onPress={exportReports}>Export reports</Button>
          <Button variant="secondary" onPress={() => setModal(null)}>Done</Button>
        </>
      );
    }

    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => setModal(null)}>
        <View style={styles.modalShade}>
          <View style={styles.modalCard}>
            <Heading>{title}</Heading>
            {body}
            <View style={styles.modalActions}>{actions}</View>
          </View>
        </View>
      </Modal>
    );
  }

  if (!loaded) {
    return <View style={styles.loading}><Text style={styles.loadingText}>Getting things ready…</Text></View>;
  }

  return (
    <View style={[styles.app, save.settings.highContrast && styles.highContrast]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      {screen === 'home' && (
        <ScrollView contentContainerStyle={styles.centeredScreen}>
          <View style={styles.brandMark}><Text style={styles.brandIcon}>⚖</Text></View>
          <Text style={styles.brand}>BALANCE</Text>
          <Text style={styles.tagline}>A little math. A lot of aha.</Text>
          <View style={styles.homeCard}>
            <Button onPress={() => openSlots('new')}>New game</Button>
            <Button variant="secondary" onPress={() => openSlots('continue')}>Continue</Button>
            <Button variant="quiet" onPress={() => openSettings('home')}>Settings</Button>
          </View>
          <Text style={styles.footerCopy}>10 curious puzzles · Play offline</Text>
          {storageError ? <Text style={styles.errorText}>{storageError}</Text> : null}
        </ScrollView>
      )}

      {screen === 'slots' && (
        <ScrollView contentContainerStyle={styles.page}>
          <Button variant="quiet" small onPress={() => setScreen('home')}>‹ Back</Button>
          <Heading large>{slotIntent === 'new' ? 'Start a new game' : 'Choose your save'}</Heading>
          <Text style={styles.subtitle}>Three independent adventures, saved on this device.</Text>
          {[1, 2, 3].map((slotId) => {
            const data = slots[slotId];
            const stars = data
              ? Object.values(data.records).reduce((sum, record) => sum + (record.bestStars ?? 0), 0)
              : 0;
            return (
              <View key={slotId} style={styles.saveCard}>
                <View style={styles.saveHeading}>
                  <Heading>Save slot {slotId}</Heading>
                  <Text style={styles.saveMeta}>{data ? `Level ${data.currentLevel}` : 'Empty slot'}</Text>
                </View>
                <Text style={styles.saveMeta}>{stars} stars · {(data?.totalScore ?? 0).toLocaleString()} points</Text>
                <Text style={styles.saveMeta}>
                  {data?.lastPlayed ? `Last played ${new Date(data.lastPlayed).toLocaleDateString()}` : 'Ready when you are'}
                </Text>
                <View style={styles.rowButtons}>
                  <Button small onPress={() => selectSlotAction(slotId, data ? 'continue' : 'new')}>
                    {data ? 'Continue' : 'Start'}
                  </Button>
                  {data && <Button small variant="secondary" onPress={() => selectSlotAction(slotId, 'new')}>Reset</Button>}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {screen === 'settings' && (
        <ScrollView contentContainerStyle={styles.page}>
          <Button variant="quiet" small onPress={finishSettings}>‹ Back</Button>
          <Heading large>Settings</Heading>
          <Text style={styles.subtitle}>Preferences are saved in save slot {selectedSlot}.</Text>
          <View style={styles.settingsCard}>
            <ToggleRow label="Show move counter" value={save.settings.showMoveCounter} onValueChange={(value) => updateSetting('showMoveCounter', value)} />
            <ToggleRow label="Sound effects" value={save.settings.soundEffects} onValueChange={(value) => updateSetting('soundEffects', value)} />
            <ToggleRow label="Music" value={save.settings.music} onValueChange={(value) => updateSetting('music', value)} />
            <ToggleRow label="Haptic feedback" value={save.settings.haptics} onValueChange={(value) => updateSetting('haptics', value)} />
            <ToggleRow label="Larger text" value={save.settings.largeText} onValueChange={(value) => updateSetting('largeText', value)} />
            <ToggleRow label="High contrast" value={save.settings.highContrast} onValueChange={(value) => updateSetting('highContrast', value)} />
          </View>
          <Button onPress={finishSettings}>Done</Button>
        </ScrollView>
      )}

      {screen === 'play' && attempt && (
        <View style={styles.gameScreen}>
          <View style={styles.gameHeader}>
            <View>
              <Text style={styles.levelLabel}>LEVEL {level.id} OF 10</Text>
              <Text style={[styles.levelTitle, { fontSize: 20 * displayScale }]}>{level.title}</Text>
            </View>
            <View style={styles.headerRight}>
              {showCounter && <Text style={styles.moveCounter}>{attempt.moves} moves</Text>}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pause game"
                onPress={() => setModal('pause')}
                style={styles.pauseButton}
              ><Text style={styles.pauseIcon}>Ⅱ</Text></Pressable>
            </View>
          </View>
          <Text style={styles.objective}>{level.objective}</Text>
          <ScrollView contentContainerStyle={styles.gameContent} keyboardShouldPersistTaps="handled">
            <View style={styles.board}>
              <View style={styles.scaleBeamWrap}>
                <View style={[styles.scaleBeam, { transform: [{ rotate: `${tilt}deg` }] }]} />
                <View style={styles.scalePivot} />
              </View>
              <View style={styles.scaleSides}>
                {renderBoardSide(0)}
                <Text style={styles.balanceSymbol}>=</Text>
                {renderBoardSide(1)}
              </View>
              {level.stable && (
                <View style={[styles.stabilityPill, isStructurallyStable(attempt) ? styles.stable : styles.unstable]}>
                  <Text style={styles.stabilityText}>
                    {isStructurallyStable(attempt) ? '●  Scale stable' : '▲  Too many tiles on one side'}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.inventoryPanel}>
              <View style={styles.inventoryHeader}>
                <Text style={styles.inventoryTitle}>YOUR TILES</Text>
                <Text style={styles.inventoryHint}>Drag to a slot · tap to choose</Text>
              </View>
              <View style={styles.inventoryTiles}>
                {inventory.map((tile) => renderTile(tile))}
              </View>
              {inventory.length === 0 && <Text style={styles.inventoryHint}>All tiles are on the scale.</Text>}
            </View>
            <View style={styles.gameTools}>
              <Button variant="secondary" small disabled={attempt.history.length === 0} onPress={() => {
                const previous = undo(attempt);
                setAttempt(previous);
                persistSave({ ...save, currentAttempt: previous });
              }}>↶ Undo</Button>
              <Button variant="quiet" small onPress={() => setModal('report')}>⚑ Report puzzle</Button>
            </View>
            <View style={styles.progressFooter}>
              <Text style={styles.footerCopy}>Slot {selectedSlot} · {Object.values(save.records).reduce((sum, item) => sum + (item.bestStars ?? 0), 0)} ★</Text>
              {storageError ? <Text style={styles.errorText}>{storageError}</Text> : null}
            </View>
          </ScrollView>
          {toast ? <Text accessibilityLiveRegion="polite" style={styles.toast}>{toast}</Text> : null}
          {renderModal()}
        </View>
      )}
      {screen !== 'play' && toast ? <Text style={styles.toast}>{toast}</Text> : null}
      {screen !== 'play' && renderModal()}
    </View>
  );
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: COLORS.background },
  highContrast: { backgroundColor: '#FFFFFF' },
  loading: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.ink, fontWeight: '700', fontSize: 18 },
  centeredScreen: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  page: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 32, paddingBottom: 36 },
  brandMark: {
    width: 90, height: 90, borderRadius: 28, backgroundColor: COLORS.yellow,
    alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }],
  },
  brandIcon: { fontSize: 52, color: COLORS.ink, fontWeight: '800' },
  brand: { marginTop: 18, color: COLORS.ink, fontSize: 42, fontWeight: '900', letterSpacing: 4 },
  tagline: { marginTop: 4, marginBottom: 30, color: COLORS.muted, fontSize: 17, fontWeight: '600' },
  homeCard: {
    width: '100%', maxWidth: 360, padding: 18, borderRadius: 24,
    backgroundColor: COLORS.card, gap: 8, elevation: 3,
  },
  footerCopy: { marginTop: 20, color: COLORS.muted, fontSize: 12, textAlign: 'center' },
  button: {
    minHeight: 50, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center', marginVertical: 4,
  },
  button_primary: { backgroundColor: COLORS.coral },
  button_secondary: { backgroundColor: COLORS.blue },
  button_quiet: { backgroundColor: 'transparent' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  buttonText_primary: { color: '#FFFFFF' },
  buttonText_secondary: { color: COLORS.ink },
  buttonText_quiet: { color: COLORS.muted },
  smallButton: { minHeight: 40, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 13 },
  smallButtonText: { fontSize: 14 },
  heading: { color: COLORS.ink, fontSize: 22, fontWeight: '900' },
  largeHeading: { fontSize: 32, marginTop: 14 },
  subtitle: { color: COLORS.muted, fontSize: 15, marginTop: 6, marginBottom: 18 },
  saveCard: {
    padding: 18, marginVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  saveHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  saveMeta: { color: COLORS.muted, fontSize: 13, marginTop: 7 },
  rowButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  settingsCard: { backgroundColor: COLORS.card, borderRadius: 20, paddingHorizontal: 16, marginBottom: 18 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderBottomWidth: 1, borderColor: COLORS.border,
  },
  toggleLabel: { color: COLORS.ink, fontSize: 16, fontWeight: '700' },
  gameScreen: { flex: 1, paddingTop: 44 },
  gameHeader: {
    paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelLabel: { color: COLORS.coral, fontWeight: '900', fontSize: 11, letterSpacing: 1.4 },
  levelTitle: { color: COLORS.ink, fontWeight: '900', marginTop: 3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moveCounter: { color: COLORS.muted, fontSize: 13, fontWeight: '800' },
  pauseButton: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.card,
    alignItems: 'center', justifyContent: 'center',
  },
  pauseIcon: { fontWeight: '900', fontSize: 20, color: COLORS.ink },
  objective: { paddingHorizontal: 18, marginTop: 8, color: COLORS.muted, fontSize: 14 },
  gameContent: { flexGrow: 1, paddingHorizontal: 12, paddingBottom: 24 },
  board: {
    marginTop: 14, paddingTop: 14, paddingBottom: 16, paddingHorizontal: 8,
    borderRadius: 24, backgroundColor: '#EAF3E9',
  },
  scaleBeamWrap: { height: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  scaleBeam: { width: '75%', height: 7, borderRadius: 6, backgroundColor: '#C98C49' },
  scalePivot: {
    position: 'absolute', top: 9, width: 0, height: 0, borderLeftWidth: 13,
    borderRightWidth: 13, borderBottomWidth: 18, borderLeftColor: 'transparent',
    borderRightColor: 'transparent', borderBottomColor: '#8C6B4E',
  },
  scaleSides: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3 },
  sideCard: {
    flex: 1, minWidth: 0, paddingVertical: 10, paddingHorizontal: 3,
    alignItems: 'center', borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.82)',
  },
  sideTitle: { fontSize: 10, color: COLORS.muted, fontWeight: '900', letterSpacing: 1 },
  total: { color: COLORS.ink, fontWeight: '900', marginVertical: 4 },
  slotRow: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 1 },
  slot: {
    flex: 1, minWidth: 22, height: 50, marginHorizontal: 1, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#DAD8D0', borderStyle: 'dashed',
    backgroundColor: '#F8F7F1', alignItems: 'center', justifyContent: 'center',
  },
  filledSlot: { borderStyle: 'solid', borderColor: '#D8C88C', overflow: 'visible' },
  targetSlot: { borderColor: COLORS.coral, backgroundColor: '#FFF2EF' },
  slotNumber: { color: '#B3B2AA', fontSize: 10, fontWeight: '800' },
  fixedTile: {
    minWidth: 25, height: 42, borderRadius: 10, borderWidth: 2, borderColor: '#80CDD3',
    backgroundColor: '#CDEDF1', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2,
  },
  fixedTileText: { color: COLORS.ink, fontWeight: '900', fontSize: 15 },
  balanceSymbol: { marginHorizontal: 1, color: COLORS.coral, fontSize: 18, fontWeight: '900' },
  stabilityPill: { alignSelf: 'center', marginTop: 12, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  stable: { backgroundColor: COLORS.green },
  unstable: { backgroundColor: '#F7C3B9' },
  stabilityText: { color: COLORS.ink, fontSize: 11, fontWeight: '800' },
  inventoryPanel: {
    minHeight: 142, marginTop: 12, padding: 12, borderRadius: 22,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  inventoryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inventoryTitle: { color: COLORS.ink, fontSize: 11, letterSpacing: 1.1, fontWeight: '900' },
  inventoryHint: { color: COLORS.muted, fontSize: 11 },
  inventoryTiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 },
  gameTools: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  progressFooter: { alignItems: 'center' },
  toast: {
    position: 'absolute', left: 18, right: 18, bottom: 24, zIndex: 10,
    backgroundColor: COLORS.ink, color: '#FFFFFF', textAlign: 'center',
    padding: 13, borderRadius: 14, fontWeight: '700', overflow: 'hidden',
  },
  errorText: { color: '#A23D2B', fontSize: 12, textAlign: 'center', marginTop: 8 },
  modalShade: { flex: 1, backgroundColor: 'rgba(29,38,53,0.45)', justifyContent: 'center', padding: 22 },
  modalCard: {
    maxHeight: '90%', backgroundColor: COLORS.card, borderRadius: 26,
    padding: 22, elevation: 10,
  },
  modalBody: { color: COLORS.muted, fontSize: 16, lineHeight: 23, marginTop: 12 },
  modalActions: { marginTop: 16, gap: 2 },
  hintBox: { marginTop: 10, padding: 14, borderRadius: 16, backgroundColor: '#F4F2EB' },
  hintExpression: {
    color: COLORS.ink, fontSize: 24, textAlign: 'center', fontWeight: '900',
    padding: 18, marginTop: 10, borderRadius: 16, backgroundColor: '#FFF4D5',
  },
  resultCard: { alignItems: 'center', paddingVertical: 12 },
  stars: { color: '#E6A928', fontSize: 34, letterSpacing: 4, marginBottom: 8 },
  resultLine: { color: COLORS.ink, fontSize: 15, fontWeight: '700', marginVertical: 3 },
});
