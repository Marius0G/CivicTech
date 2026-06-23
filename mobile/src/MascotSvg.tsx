// MascotSvg — Pip drawn with react-native-svg (already a dependency). Illustrated vector frog
// modelled on character.png: round blue/green body with a gold crown, a ring of EU stars on a
// cream belly, big friendly eyes, a raised waving hand and webbed feet. Real gradients + line-art
// instead of stacked geometric Views, so it reads as "designed", not placeholder.
//
// This is the JS-only renderer: works today with no native build, and is the automatic fallback
// whenever the Rive asset isn't configured yet (see Mascot.tsx). Same MascotProps as the Rive one.
//
// Whole-body motion (breathe/jump/wiggle) runs on the native driver via the wrapping Animated.View;
// per-part motion (jaw, blink) animates numeric SVG props off the JS driver. `levelValue` (0..1)
// drives the jaw for real lip-sync; without it, `speaking` runs a canned mouth oscillation.

import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle, Defs, Ellipse, G, LinearGradient, Path, Polygon, RadialGradient, Stop,
} from 'react-native-svg';
import { MascotProps } from './mascotProps';

// body (top→bottom gradient), darker line/shade, cream belly
const PALETTES = {
  green: { top: '#23D85B', bot: '#00A52F', line: '#04822B', belly: '#F4FFF6', bellyEdge: '#D4F6DD' },
  blue: { top: '#5B8CF0', bot: '#2E5AD8', line: '#1E3D9E', belly: '#F3F7FF', bellyEdge: '#D7E2FB' },
  coral: { top: '#FF9E7A', bot: '#FA4820', line: '#C9351A', belly: '#FFF6F2', bellyEdge: '#FFD9C9' },
};
const CROWN_TOP = '#FFE07A';
const CROWN_BOT = '#F5B731';
const CROWN_LINE = '#D9981C';
const STAR_GOLD = '#F5C24B';
const MOUTH = '#7A1F3D';
const TONGUE = '#E96A86';

const AEllipse = Animated.createAnimatedComponent(Ellipse);

// points string for a 5-pointed star centred at (cx,cy)
function star(cx: number, cy: number, outer: number, inner = outer * 0.42): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

export default function MascotSvg({ speaking, celebrate, size = 128, palette = 'green', levelValue }: MascotProps) {
  const c = PALETTES[palette];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, ''); // unique gradient ids per instance

  const breathe = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const internalMouth = useRef(new Animated.Value(0)).current;
  const jump = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;

  // The jaw follows live amplitude when provided, else the canned talking oscillation.
  const mouthSource = levelValue ?? internalMouth;

  // idle breathing
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  // blink on a randomised cadence (jitter avoids the robotic look)
  useEffect(() => {
    let alive = true;
    const schedule = () => {
      setTimeout(() => {
        if (!alive) return;
        Animated.sequence([
          Animated.timing(blink, { toValue: 0.08, duration: 80, useNativeDriver: false }),
          Animated.timing(blink, { toValue: 1, duration: 110, useNativeDriver: false }),
        ]).start(schedule);
      }, 2200 + Math.floor(Math.random() * 3200));
    };
    schedule();
    return () => { alive = false; };
  }, [blink]);

  // canned talking mouth — ONLY when we have no live amplitude source
  useEffect(() => {
    if (levelValue) return; // live lip-sync drives the jaw instead
    if (speaking) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(internalMouth, { toValue: 1, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(internalMouth, { toValue: 0.3, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver: false }),
          Animated.timing(internalMouth, { toValue: 0.8, duration: 95, easing: Easing.out(Easing.quad), useNativeDriver: false }),
          Animated.timing(internalMouth, { toValue: 0.22, duration: 120, easing: Easing.in(Easing.quad), useNativeDriver: false }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    Animated.timing(internalMouth, { toValue: 0, duration: 140, useNativeDriver: false }).start();
    return undefined;
  }, [speaking, internalMouth, levelValue]);

  // celebrate: jump + wiggle + sparkle burst
  useEffect(() => {
    if (!celebrate) return;
    sparkle.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(jump, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(jump, { toValue: 0, friction: 4, tension: 80, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -1, duration: 200, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0, duration: 110, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(sparkle, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(sparkle, { toValue: 0, duration: 900, delay: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, [celebrate, jump, wiggle, sparkle]);

  // whole-body transforms (native driver)
  const bobY = breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const jumpY = jump.interpolate({ inputRange: [0, 1], outputRange: [0, -34] });
  const squish = jump.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const rotate = wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] });
  const sparkleScale = sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.3] });

  // per-part (JS driver) — clamp so a stray >1 amplitude can't blow the jaw open
  const clamped = mouthSource.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  const mouthRy = clamped.interpolate({ inputRange: [0, 1], outputRange: [1.2, 13] });
  const tongueRy = clamped.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });
  const eyeRy = blink.interpolate({ inputRange: [0, 1], outputRange: [1.2, 17] });
  const pupilRy = blink.interpolate({ inputRange: [0, 1], outputRange: [0.8, 10] });

  const gBody = `body${uid}`;
  const gBelly = `belly${uid}`;
  const gCrown = `crown${uid}`;

  return (
    <View style={[styles.stage, { width: size, height: size }]} pointerEvents="none">
      <Animated.Text style={[styles.sparkle, { left: size * 0.06, opacity: sparkle, transform: [{ scale: sparkleScale }] }]}>✨</Animated.Text>
      <Animated.Text style={[styles.sparkle, { right: size * 0.06, opacity: sparkle, transform: [{ scale: sparkleScale }] }]}>🎉</Animated.Text>

      <Animated.View
        style={{ width: size, height: size, transform: [{ translateY: Animated.add(bobY, jumpY) }, { rotate }, { scale: squish }] }}
      >
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            <LinearGradient id={gBody} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.top} />
              <Stop offset="1" stopColor={c.bot} />
            </LinearGradient>
            <RadialGradient id={gBelly} cx="0.5" cy="0.4" r="0.7">
              <Stop offset="0" stopColor={c.belly} />
              <Stop offset="1" stopColor={c.bellyEdge} />
            </RadialGradient>
            <LinearGradient id={gCrown} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={CROWN_TOP} />
              <Stop offset="1" stopColor={CROWN_BOT} />
            </LinearGradient>
          </Defs>

          {/* webbed feet (behind body) */}
          <Ellipse cx="58" cy="176" rx="26" ry="13" fill={c.bot} stroke={c.line} strokeWidth="3" />
          <Ellipse cx="142" cy="176" rx="26" ry="13" fill={c.bot} stroke={c.line} strokeWidth="3" />

          {/* left resting hand + raised waving hand (matches character.png pose) */}
          <Ellipse cx="40" cy="142" rx="12" ry="14" fill={`url(#${gBody})`} stroke={c.line} strokeWidth="3" />
          <Ellipse cx="166" cy="96" rx="12" ry="14" fill={`url(#${gBody})`} stroke={c.line} strokeWidth="3" transform="rotate(20 166 96)" />

          {/* body */}
          <Ellipse cx="100" cy="120" rx="62" ry="58" fill={`url(#${gBody})`} stroke={c.line} strokeWidth="3.5" />

          {/* belly with EU star ring */}
          <Ellipse cx="100" cy="134" rx="40" ry="38" fill={`url(#${gBelly})`} />
          <G>
            {Array.from({ length: 12 }).map((_, i) => {
              const a = (Math.PI / 6) * i - Math.PI / 2;
              const cx = 100 + 27 * Math.cos(a);
              const cy = 134 + 27 * Math.sin(a);
              return <Polygon key={i} points={star(cx, cy, 4.4)} fill={STAR_GOLD} />;
            })}
          </G>

          {/* eye bumps */}
          <Circle cx="72" cy="60" r="26" fill={`url(#${gBody})`} stroke={c.line} strokeWidth="3.5" />
          <Circle cx="128" cy="60" r="26" fill={`url(#${gBody})`} stroke={c.line} strokeWidth="3.5" />

          {/* eye whites + pupils + shine (blink scales ry) */}
          <AEllipse cx="72" cy="62" rx="17" ry={eyeRy} fill="#FFFFFF" stroke={c.line} strokeWidth="2" />
          <AEllipse cx="128" cy="62" rx="17" ry={eyeRy} fill="#FFFFFF" stroke={c.line} strokeWidth="2" />
          <AEllipse cx="76" cy="64" rx="8.5" ry={pupilRy} fill="#10202A" />
          <AEllipse cx="132" cy="64" rx="8.5" ry={pupilRy} fill="#10202A" />
          <Circle cx="71" cy="57" r="3.4" fill="#FFFFFF" />
          <Circle cx="127" cy="57" r="3.4" fill="#FFFFFF" />

          {/* cheeks */}
          <Ellipse cx="62" cy="140" rx="9" ry="6" fill="#FF8B87" opacity={0.5} />
          <Ellipse cx="138" cy="140" rx="9" ry="6" fill="#FF8B87" opacity={0.5} />
          {/* nostrils */}
          <Circle cx="93" cy="126" r="2.3" fill={c.line} />
          <Circle cx="107" cy="126" r="2.3" fill={c.line} />

          {/* mouth: always-present smile, opens into a cavity with the jaw */}
          <Path d="M78 142 Q100 158 122 142" stroke={c.line} strokeWidth="3" strokeLinecap="round" fill="none" />
          <AEllipse cx="100" cy="150" rx="21" ry={mouthRy} fill={MOUTH} />
          <AEllipse cx="100" cy="156" rx="13" ry={tongueRy} fill={TONGUE} />

          {/* crown */}
          <G>
            <Path
              d="M72 44 L72 30 L84 38 L100 22 L116 38 L128 30 L128 44 Z"
              fill={`url(#${gCrown})`}
              stroke={CROWN_LINE}
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <Circle cx="100" cy="26" r="3" fill="#FF6B6B" />
            <Circle cx="84" cy="36" r="2.4" fill="#6BD0FF" />
            <Circle cx="116" cy="36" r="2.4" fill="#6BD0FF" />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center' },
  sparkle: { position: 'absolute', top: 0, fontSize: 22, zIndex: 3 },
});
