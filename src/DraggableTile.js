import React, { useMemo, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';

export default function DraggableTile({ tile, selected, compact = false, onSelect, onDrop }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 4,
    onPanResponderMove: (_, gesture) => setOffset({ x: gesture.dx, y: gesture.dy }),
    onPanResponderRelease: (_, gesture) => {
      setOffset({ x: 0, y: 0 });
      if (Math.abs(gesture.dx) + Math.abs(gesture.dy) < 8) onSelect(tile.id);
      else onDrop(tile.id, gesture.moveX, gesture.moveY);
    },
    onPanResponderTerminate: () => setOffset({ x: 0, y: 0 }),
  }), [onDrop, onSelect, tile.id]);

  return (
    <Animated.View
      {...responder.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={`${tile.label} tile. Drag to move, or tap then choose a slot.`}
      style={[
        styles.tile,
        compact && styles.compact,
        tile.kind === 'operator' && styles.operator,
        tile.kind === 'paren' && styles.paren,
        selected && styles.selected,
        { transform: [{ translateX: offset.x }, { translateY: offset.y }] },
      ]}
    >
      <Text style={[styles.label, compact && styles.compactLabel]}>{tile.label}</Text>
      {selected && <View style={styles.selectionDot} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    minWidth: 48,
    minHeight: 52,
    paddingHorizontal: 10,
    margin: 4,
    borderRadius: 16,
    backgroundColor: '#FFE08A',
    borderColor: '#F6BC43',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    zIndex: 2,
  },
  compact: {
    minWidth: 28,
    minHeight: 44,
    paddingHorizontal: 2,
    margin: 1,
    borderRadius: 12,
  },
  operator: {
    backgroundColor: '#CDEDF1',
    borderColor: '#80CDD3',
  },
  paren: {
    backgroundColor: '#E4D6FF',
    borderColor: '#B8A0F3',
  },
  selected: {
    borderColor: '#F06449',
    borderWidth: 3,
  },
  label: {
    color: '#25324A',
    fontSize: 20,
    fontWeight: '800',
  },
  compactLabel: {
    fontSize: 16,
  },
  selectionDot: {
    position: 'absolute',
    right: -3,
    top: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F06449',
  },
});
