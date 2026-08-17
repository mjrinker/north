<script lang="ts">
	let {
		value,
		rev,
		target = null as number | null,
		uid,
		onchange,
		ondragstart
	}: {
		value: number;
		rev: number;
		target?: number | null;
		uid: string;
		onchange: (v: number) => void;
		ondragstart?: () => void;
	} = $props();

	let fullRev = $derived(rev > 0 ? rev : (target ?? 3600));
	let standardReached = $derived(rev > 0 ? value >= rev : value > 0);
	let standardProgress = $derived(
		rev > 0 ? Math.max(0, Math.min(1, value / rev)) : value > 0 ? 1 : 0
	);
	let handleAngle = $derived((value / fullRev) * 360);
	let targetProgress = $derived(
		target != null && target > rev ? Math.max(0, Math.min(1, (value - rev) / (target - rev))) : 0
	);
	let targetMet = $derived(target != null && value >= target);

	const R = 16.5;
	const CIRC = 2 * Math.PI * R;
	let knobDeg = $derived(handleAngle - 90);
	let knobX = $derived(18 + R * Math.cos((knobDeg * Math.PI) / 180));
	let knobY = $derived(18 + R * Math.sin((knobDeg * Math.PI) / 180));

	let ringEl = $state<HTMLElement>();
	let centerX = 0;
	let centerY = 0;
	let lastAngle: number | null = null;
	let accum = 0;

	function angleFromPoint(x: number, y: number): number {
		return (Math.atan2(y - centerY, x - centerX) * 180) / Math.PI;
	}
	function onPointerDown(e: PointerEvent) {
		e.preventDefault();
		const el = ringEl;
		if (!el) return;
		el.setPointerCapture?.(e.pointerId);
		const r = el.getBoundingClientRect();
		centerX = r.left + r.width / 2;
		centerY = r.top + r.height / 2;
		lastAngle = angleFromPoint(e.clientX, e.clientY);
		accum = 0;
		ondragstart?.();
	}
	function onPointerMove(e: PointerEvent) {
		if (lastAngle == null) return;
		let delta = angleFromPoint(e.clientX, e.clientY) - lastAngle;
		if (delta > 180) delta -= 360;
		if (delta < -180) delta += 360;
		lastAngle = angleFromPoint(e.clientX, e.clientY);
		accum += (delta / 360) * fullRev;
		const whole = Math.trunc(accum);
		if (whole !== 0) {
			accum -= whole;
			onchange?.(Math.max(0, value + whole));
		}
	}
	function onPointerUp() {
		lastAngle = null;
	}

	function sparkleTime(i: number): { delay: number; dur: number } {
		const frac = (seed: number) => {
			const v = Math.abs(Math.sin(i * seed + 78.233) % 1) * 43758.5453;
			return v - Math.floor(v);
		};
		return { delay: frac(12.9898) * 2, dur: 0.6 + frac(39.3467) * 1.4 };
	}
</script>

<div
	class="ring-layer"
	class:target-met={targetMet}
	bind:this={ringEl}
	role="slider"
	tabindex="0"
	aria-label="Adjust value"
	aria-valuemin="0"
	aria-valuenow={Math.round(value)}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={onPointerUp}
	onpointercancel={onPointerUp}
	oncontextmenu={(e) => e.preventDefault()}
>
	<svg viewBox="0 0 36 36" class="ring" aria-hidden="true">
		<defs>
			<linearGradient id="ring-gold-{uid}" x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" stop-color="#f5d778" />
				<stop offset="55%" stop-color="#e8c64a" />
				<stop offset="100%" stop-color="#c9a227" />
			</linearGradient>
		</defs>
		<circle class="ring-track" cx="18" cy="18" r={R} />
		{#if standardReached}
			<circle
				class="ring-prog green"
				cx="18"
				cy="18"
				r={R}
				stroke-dasharray={CIRC}
				stroke-dashoffset="0"
				transform="rotate(-90 18 18)"
			/>
			{#if target != null}
				<circle
					class="ring-prog gold"
					cx="18"
					cy="18"
					r={R}
					stroke-dasharray={CIRC}
					stroke-dashoffset={CIRC * (1 - targetProgress)}
					transform="rotate(-90 18 18)"
					style:stroke="url(#ring-gold-{uid})"
				/>
			{/if}
		{:else}
			<circle
				class="ring-prog green"
				cx="18"
				cy="18"
				r={R}
				stroke-dasharray={CIRC}
				stroke-dashoffset={CIRC * (1 - standardProgress)}
				transform="rotate(-90 18 18)"
			/>
		{/if}
		<circle class="ring-knob" cx={knobX} cy={knobY} r="1.2" />
	</svg>
	{#if targetMet}
		{#each [0, 1, 2, 3, 4, 5] as i (i)}
			<span
				class="sparkle"
				style:--tw-delay={`${sparkleTime(i).delay}s`}
				style:--tw-dur={`${sparkleTime(i).dur}s`}
			></span>
		{/each}
	{/if}
</div>

<style>
	.ring-layer {
		position: absolute;
		inset: 0;
		z-index: 2;
		cursor: grab;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}
	.ring-layer:active {
		cursor: grabbing;
	}
	.ring-layer .ring {
		width: 100%;
		height: 100%;
		display: block;
	}
	.ring-track {
		fill: none;
		stroke: var(--card-border, #ddd);
		stroke-width: 0.8;
	}
	.ring-prog {
		fill: none;
		stroke-width: 0.8;
		stroke-linecap: round;
	}
	.ring-prog.green {
		stroke: #2e7d32;
	}
	.ring-knob {
		fill: #fff;
		stroke: #2e7d32;
		stroke-width: 0.5;
	}
	.ring-layer.target-met {
		animation: gold-pulse 1.8s ease-in-out infinite;
	}
	.ring-layer.target-met .ring-knob {
		stroke: #e8c64a;
	}
	.ring-layer .sparkle {
		position: absolute;
		z-index: 1;
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			#fff 0%,
			rgba(255, 255, 255, 0.9) 45%,
			rgba(255, 255, 255, 0) 72%
		);
		opacity: 0;
		pointer-events: none;
		filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.8));
		animation: twinkle var(--tw-dur, 1.6s) ease-in-out infinite;
		animation-delay: var(--tw-delay, 0s);
	}
	.ring-layer .sparkle:nth-of-type(1) {
		top: 12%;
		left: 18%;
	}
	.ring-layer .sparkle:nth-of-type(2) {
		top: 68%;
		left: 26%;
	}
	.ring-layer .sparkle:nth-of-type(3) {
		top: 22%;
		left: 60%;
	}
	.ring-layer .sparkle:nth-of-type(4) {
		top: 64%;
		left: 72%;
	}
	.ring-layer .sparkle:nth-of-type(5) {
		top: 44%;
		left: 44%;
	}
	.ring-layer .sparkle:nth-of-type(6) {
		top: 80%;
		left: 54%;
	}
	@keyframes gold-pulse {
		0%,
		100% {
			filter: drop-shadow(0 0 1px rgba(232, 198, 74, 0.4));
		}
		50% {
			filter: drop-shadow(0 0 5px rgba(232, 198, 74, 0.9));
		}
	}
	@keyframes twinkle {
		0%,
		100% {
			opacity: 0;
			transform: scale(0.5);
		}
		50% {
			opacity: 1;
			transform: scale(1.2);
		}
	}
</style>
