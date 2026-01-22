<script lang="ts">
	import { user, userDisplayName, hasCompletedOnboarding, stats, periodSummaries, getCurrentHalfYearPeriod } from '$lib/stores';
	import { getAverageHoursStatus } from '$lib/utils';
	import type { AverageHoursStatus } from '$lib/utils';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Browser } from '@capacitor/browser';

	let avgHoursStatus = $state<AverageHoursStatus | null>(null);
	let loading = $state(true);
	let currentPeriod = $state(getCurrentHalfYearPeriod());

	// Work pins data
	interface WorkPins {
		day: string | null;
		afternoon: string | null;
		graveyard: string | null;
		lastUpdated: string | null;
	}
	let workPins = $state<WorkPins>({ day: null, afternoon: null, graveyard: null, lastUpdated: null });
	let pinsLoading = $state(true);

	onMount(async () => {
		// Redirect to onboarding if user hasn't set up profile
		if (!$hasCompletedOnboarding) {
			goto('/onboarding');
			return;
		}

		// Check for period summary (6-month reset)
		await periodSummaries.checkAndCreatePeriodSummary();

		// Load all data
		await Promise.all([
			stats.load(),
			loadAverageHoursStatus(),
			loadWorkPins()
		]);

		loading = false;
	});

	async function loadAverageHoursStatus() {
		avgHoursStatus = await getAverageHoursStatus($user);
	}

	async function loadWorkPins() {
		try {
			// Fetch from ILWU greaseboard - using a CORS proxy or direct fetch
			const response = await fetch('https://ilwu502.ca/greaseboard/work-board/');
			const html = await response.text();

			// Parse the gbData from the HTML
			const gbDataMatch = html.match(/var\s+gbData\s*=\s*(\{[\s\S]*?\});/);
			if (gbDataMatch) {
				const gbData = JSON.parse(gbDataMatch[1]);

				// Extract pin numbers from the data
				// The structure has shifts with job categories containing pin ranges
				if (gbData.shifts) {
					const shifts = gbData.shifts;

					// Day shift (8am)
					if (shifts['8am']) {
						const dayJobs = shifts['8am'].jobs || [];
						const firstDayJob = dayJobs.find((j: any) => j.pin_from);
						workPins.day = firstDayJob ? `${firstDayJob.pin_from}` : '--';
					}

					// Afternoon shift (4:30pm)
					if (shifts['430pm']) {
						const aftJobs = shifts['430pm'].jobs || [];
						const firstAftJob = aftJobs.find((j: any) => j.pin_from);
						workPins.afternoon = firstAftJob ? `${firstAftJob.pin_from}` : '--';
					}

					// Graveyard shift (1am)
					if (shifts['1am']) {
						const grvJobs = shifts['1am'].jobs || [];
						const firstGrvJob = grvJobs.find((j: any) => j.pin_from);
						workPins.graveyard = firstGrvJob ? `${firstGrvJob.pin_from}` : '--';
					}

					workPins.lastUpdated = new Date().toLocaleTimeString('default', { hour: 'numeric', minute: '2-digit' });
				}
			}
		} catch (error) {
			console.error('Failed to load work pins:', error);
			workPins = { day: '--', afternoon: '--', graveyard: '--', lastUpdated: null };
		}
		pinsLoading = false;
	}

	async function openExternalLink(url: string) {
		try {
			await Browser.open({ url });
		} catch {
			// Fallback for web
			window.open(url, '_blank');
		}
	}
</script>

<div class="p-4 space-y-4">
	<!-- Header -->
	<header class="mb-6">
		<p class="text-gray-500 text-sm">Welcome back,</p>
		<h1 class="text-2xl font-bold text-gray-900">{$userDisplayName}</h1>
		{#if $user}
			<p class="text-gray-500 text-sm">Man #{$user.man_number} {$user.current_board ? `| Board ${$user.current_board}` : ''}</p>
		{/if}
	</header>

	{#if loading}
		<div class="flex justify-center py-8">
			<div class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
		</div>
	{:else}
		<!-- Average Hours Card -->
		{#if avgHoursStatus}
			<div class="card-elevated">
				<div class="flex justify-between items-start mb-2">
					<div>
						<h2 class="font-semibold text-gray-900">Average Hours</h2>
						<p class="text-xs text-gray-500">{currentPeriod.label} • Board move eligibility</p>
					</div>
					<span class="text-sm text-gray-500">{avgHoursStatus.daysRemaining} days left</span>
				</div>
				<div class="progress-bar mb-2">
					<div
						class="progress-fill {avgHoursStatus.onTrack ? 'bg-blue-600' : 'bg-amber-500'}"
						style="width: {avgHoursStatus.progressPercent}%"
					></div>
				</div>
				<div class="flex justify-between items-center">
					<p class="text-sm text-gray-600">
						<span class="font-semibold text-gray-900">{avgHoursStatus.currentHours.toFixed(1)}</span>
						/ {avgHoursStatus.targetHours} hrs
					</p>
					{#if avgHoursStatus.hoursNeeded > 0}
						<p class="text-xs {avgHoursStatus.onTrack ? 'text-green-600' : 'text-amber-600'}">
							{avgHoursStatus.onTrack ? 'On track' : `Need ${avgHoursStatus.pacePerDay.toFixed(1)} hrs/day`}
						</p>
					{:else}
						<p class="text-xs text-green-600 font-medium">Target reached!</p>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Work Pins Card -->
		<div class="card">
			<div class="flex items-center justify-between mb-3">
				<div class="flex items-center gap-2">
					<div class="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-amber-600">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
						</svg>
					</div>
					<h3 class="font-medium text-gray-900">Work Pins</h3>
				</div>
				<button
					onclick={() => openExternalLink('https://ilwu502.ca/greaseboard/work-board-8am/?gb_data_refresh')}
					class="font-medium text-blue-500 hover:text-blue-600"
				>
					Greaseboard
				</button>
			</div>
			{#if pinsLoading}
				<div class="flex justify-center py-2">
					<div class="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
				</div>
			{:else}
				<div class="grid grid-cols-3 gap-2 text-center">
					<div class="bg-gray-50 rounded-lg p-2">
						<p class="text-xs text-gray-500">Day</p>
						<p class="text-lg font-bold text-gray-900">{workPins.day || '--'}</p>
						<p class="text-xs text-gray-400">8am</p>
					</div>
					<div class="bg-gray-50 rounded-lg p-2">
						<p class="text-xs text-gray-500">Afternoon</p>
						<p class="text-lg font-bold text-gray-900">{workPins.afternoon || '--'}</p>
						<p class="text-xs text-gray-400">4:30pm</p>
					</div>
					<div class="bg-gray-50 rounded-lg p-2">
						<p class="text-xs text-gray-500">Graveyard</p>
						<p class="text-lg font-bold text-gray-900">{workPins.graveyard || '--'}</p>
						<p class="text-xs text-gray-400">1am</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- External Links - Pre-D and ADP -->
		<div class="grid grid-cols-2 gap-3">
			<!-- Pre-D Card (formerly Memberlink) -->
			<button
				onclick={() => openExternalLink('https://workers.ilwu502.ca/')}
				class="card hover:bg-gray-50 transition-colors text-left"
			>
				<div class="flex items-center gap-2 mb-1">
					<div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-blue-600">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
						</svg>
					</div>
					<span class="font-medium text-gray-900">Pre-D</span>
				</div>
				<p class="text-xs text-gray-500">Member Link Login</p>
			</button>

			<!-- ADP Card -->
			<button
				onclick={() => openExternalLink('https://reports.adp.ca')}
				class="card hover:bg-gray-50 transition-colors text-left"
			>
				<div class="flex items-center gap-2 mb-1">
					<div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-green-600">
							<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
						</svg>
					</div>
					<span class="font-medium text-gray-900">ADP</span>
				</div>
				<p class="text-xs text-gray-500">View Pay Stubs</p>
			</button>
		</div>

		<!-- Documents Card -->
		<a href="/documents" class="block card hover:bg-gray-50 transition-colors">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 bg-primary-light rounded-lg flex items-center justify-center">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-primary">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
					</svg>
				</div>
				<div class="flex-1">
					<h3 class="font-medium text-gray-900">Documents</h3>
					<p class="text-sm text-gray-500">Manning sheets, pay stubs & more</p>
				</div>
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-400">
					<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
				</svg>
			</div>
		</a>

		<!-- WhatsApp/Telegram Share Card -->
		<a href="/share" class="block card hover:bg-gray-50 transition-colors">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 bg-primary-light rounded-lg flex items-center justify-center">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-primary">
						<path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
					</svg>
				</div>
				<div class="flex-1">
					<h3 class="font-medium text-gray-900">WhatsApp / Telegram</h3>
					<p class="text-sm text-gray-500">Share docs to work groups</p>
				</div>
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-400">
					<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
				</svg>
			</div>
		</a>

		<!-- Camera Card -->
		<a href="/camera" class="block card-elevated bg-blue-600 text-white">
			<div class="flex items-center justify-center gap-3 py-2">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
				</svg>
				<span class="font-semibold">Camera</span>
			</div>
			<p class="text-center text-sm text-blue-100 -mt-1">Capture manning sheets, toolbox talks</p>
		</a>
	{/if}
</div>
