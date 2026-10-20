<script lang="ts">
	let {
		value,
		rev,
		target = null as number | null,
		dragRev,
		uid,
		onchange,
		ondragstart
	}: {
		value: number;
		rev: number;
		target?: number | null;
		dragRev?: number;
		uid: string;
		onchange: (v: number) => void;
		ondragstart?: () => void;
	} = $props();

	let fullRev = $derived(rev > 0 ? rev : (target ?? 3600));
	let stepRev = $derived(dragRev ?? fullRev);
	let standardReached = $derived(rev > 0 ? value >= rev : value > 0);
	let standardProgress = $derived(
		rev > 0 ? Math.max(0, Math.min(1, value / rev)) : value > 0 ? 1 : 0
	);
	let handleAngle = $derived((value / stepRev) * 360);
	let targetProgress = $derived(
		target != null && target > rev ? Math.max(0, Math.min(1, (value - rev) / (target - rev))) : 0
	);
	let targetMet = $derived(target != null && value >= target);

	const R = 17;
	const CIRC = 2 * Math.PI * R;
	let active = false;
	let grabAngle: number | null = null;
	let knobDeg = $derived(active && grabAngle != null ? grabAngle : handleAngle - 90);
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
		active = true;
		grabAngle = lastAngle;
		ondragstart?.();
	}
	function onPointerMove(e: PointerEvent) {
		if (lastAngle == null) return;
		const ang = angleFromPoint(e.clientX, e.clientY);
		grabAngle = ang;
		let delta = ang - lastAngle;
		if (delta > 180) delta -= 360;
		if (delta < -180) delta += 360;
		lastAngle = ang;
		accum += (delta / 360) * stepRev;
		const whole = Math.trunc(accum);
		if (whole !== 0) {
			accum -= whole;
			onchange?.(Math.max(0, value + whole));
		}
	}
	function onPointerUp() {
		lastAngle = null;
		active = false;
		grabAngle = null;
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
		<circle class="ring-track" cx="18" cy="18" r={R} />
		{#if standardReached}
			{#if target != null && target > rev}
				<circle
					class="ring-prog green"
					cx="18"
					cy="18"
					r={R}
					stroke-dasharray={CIRC}
					stroke-dashoffset="0"
					transform="rotate(-90 18 18)"
				/>
				<circle
					class="ring-prog gold"
					cx="18"
					cy="18"
					r={R}
					stroke-dasharray={CIRC}
					stroke-dashoffset={CIRC * (1 - targetProgress)}
					transform="rotate(-90 18 18)"
				/>
			{:else if target != null}
				<circle
					class="ring-prog gold"
					cx="18"
					cy="18"
					r={R}
					stroke-dasharray={CIRC}
					stroke-dashoffset="0"
					transform="rotate(-90 18 18)"
				/>
			{:else}
				<circle
					class="ring-prog green"
					cx="18"
					cy="18"
					r={R}
					stroke-dasharray={CIRC}
					stroke-dashoffset="0"
					transform="rotate(-90 18 18)"
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
		<circle class="ring-knob" cx={knobX} cy={knobY} r="1.4" />
	</svg>
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
		overflow: visible;
	}
	.ring-track {
		fill: none;
		stroke: color-mix(in srgb, var(--habit, var(--accent)) 14%, transparent);
		stroke-width: 1.8;
	}
	.ring-prog {
		fill: none;
		stroke-width: 1.8;
		stroke-linecap: round;
		transition: stroke-dashoffset 0.2s var(--ease);
	}
	.ring-prog.green {
		stroke: var(--habit-ink, var(--accent));
	}
	.ring-prog.gold {
		stroke: var(--success);
	}
	.ring-knob {
		fill: #fff;
		stroke: var(--habit, var(--accent));
		stroke-width: 0.6;
		filter: drop-shadow(0 0.3px 0.6px rgba(0, 0, 0, 0.3));
	}
	.ring-layer.target-met .ring-knob {
		stroke: var(--success);
	}
</style>
