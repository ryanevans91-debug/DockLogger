<script lang="ts">
	import { onMount } from 'svelte';
	import { user, entries, ratedJobs, formatCurrency, formatHours, stats, timeOff, vacationDaysYTD, sickDaysYTD, getCurrentHalfYearPeriod } from '$lib/stores';
	import { entryQueries } from '$lib/db';
	import type { Entry } from '$lib/db';
	import { calculateTaxBreakdown, type TaxBreakdown } from '$lib/utils/taxes';
	import { getStatHolidayStatus, getAverageHoursStatus } from '$lib/utils';
	import type { StatHolidayStatus, AverageHoursStatus } from '$lib/utils';

	type Period = 'week' | 'month' | 'quarter' | 'year';

	let selectedPeriod = $state<Period>('month');
	let periodEntries = $state<Entry[]>([]);
	let totalHours = $state(0);
	let totalEarnings = $state(0);

	// Year-to-date earnings for tax calculations
	let ytdEarnings = $state(0);
	let ytdTaxBreakdown = $state<TaxBreakdown | null>(null);

	// Stats for the 4 cards
	let quickStatsLoaded = $state(false);
	let statStatus = $state<StatHolidayStatus | null>(null);
	let avgHoursStatus = $state<AverageHoursStatus | null>(null);
	let daysWorkedThisPeriod = $state(0);
	let currentPeriod = $state(getCurrentHalfYearPeriod());
	let sixMonthHours = $state(0);
	let sixMonthEarnings = $state(0);
	let careerHours = $state(0);

	// Get date range for period
	function getDateRange(period: Period): { start: string; end: string } {
		const now = new Date();
		let start: Date;
		let end: Date = now;

		switch (period) {
			case 'week':
				const dayOfWeek = now.getDay();
				start = new Date(now);
				start.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
				break;
			case 'month':
				start = new Date(now.getFullYear(), now.getMonth(), 1);
				end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
				break;
			case 'quarter':
				const quarter = Math.floor(now.getMonth() / 3);
				start = new Date(now.getFullYear(), quarter * 3, 1);
				end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
				break;
			case 'year':
				start = new Date(now.getFullYear(), 0, 1);
				end = new Date(now.getFullYear(), 11, 31);
				break;
		}

		return {
			start: start.toISOString().split('T')[0],
			end: end.toISOString().split('T')[0]
		};
	}

	// Load data when period changes
	$effect(() => {
		loadPeriodData();
	});

	async function loadPeriodData() {
		const { start, end } = getDateRange(selectedPeriod);
		periodEntries = await entries.loadDateRange(start, end);
		totalHours = await entryQueries.getTotalHours(start, end);
		totalEarnings = await entryQueries.getTotalEarnings(start, end);
	}

	async function loadYTDData() {
		const { start, end } = getDateRange('year');
		ytdEarnings = await entryQueries.getTotalEarnings(start, end);
		// Calculate tax breakdown based on YTD earnings projected to full year
		if (ytdEarnings > 0) {
			// Get days worked this year for projection
			const ytdEntries = await entries.loadDateRange(start, end);
			const daysWorked = ytdEntries.length;

			if (daysWorked > 0) {
				const today = new Date();
				const startOfYear = new Date(today.getFullYear(), 0, 1);
				const daysPassed = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;

				// Project annual income based on current pace
				const avgDailyEarnings = ytdEarnings / daysWorked;
				const projectedWorkDays = Math.min(Math.round(daysWorked * (365 / daysPassed)), 260);
				const projectedAnnual = avgDailyEarnings * projectedWorkDays;

				ytdTaxBreakdown = calculateTaxBreakdown(projectedAnnual);
			}
		}
	}

	// Get job name for entry
	function getJobName(entry: Entry): string {
		if (entry.job_type === 'hall') {
			return entry.hall_job_name || 'Hall Job';
		}
		const job = $ratedJobs.find(j => j.id === entry.rated_job_id);
		return job?.name || 'Rated Job';
	}

	// Get period label
	function getPeriodLabel(period: Period): string {
		const { start, end } = getDateRange(period);
		const startDate = new Date(start);
		const endDate = new Date(end);

		switch (period) {
			case 'week':
				return `${startDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('default', { month: 'short', day: 'numeric' })}`;
			case 'month':
				return startDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });
			case 'quarter':
				const quarter = Math.floor(startDate.getMonth() / 3) + 1;
				return `Q${quarter} ${startDate.getFullYear()}`;
			case 'year':
				return startDate.getFullYear().toString();
		}
	}

	// Pension progress
	let pensionProgress = $derived(() => {
		if (!$user?.pension_target || $user.pension_target <= 0) return 0;
		const yearRange = getDateRange('year');
		// We use totalEarnings which is already loaded, but this is approximate
		// For accurate pension tracking, we'd need to calculate YTD earnings
		return Math.min((totalEarnings / $user.pension_target) * 100, 100);
	});

	async function loadStatHolidayStatus() {
		statStatus = await getStatHolidayStatus($user);
	}

	async function loadAverageHoursStatus() {
		avgHoursStatus = await getAverageHoursStatus($user);
		// Days worked is estimated from hours
		daysWorkedThisPeriod = avgHoursStatus?.currentHours ? Math.ceil(avgHoursStatus.currentHours / 8) : 0;
	}

	async function loadSixMonthData() {
		const period = getCurrentHalfYearPeriod();
		sixMonthHours = await entryQueries.getTotalHours(period.start, period.end);
		sixMonthEarnings = await entryQueries.getTotalEarnings(period.start, period.end);
	}

	function formatShortDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('default', {
			month: 'short',
			day: 'numeric'
		});
	}

	onMount(async () => {
		await Promise.all([
			stats.load(),
			timeOff.load(),
			loadStatHolidayStatus(),
			loadAverageHoursStatus(),
			loadSixMonthData()
		]);
		careerHours = $user?.career_hours || 0;
		quickStatsLoaded = true;
		loadPeriodData();
		loadYTDData();
	});
</script>

<div class="p-4 pb-24 space-y-4">
	<header class="mb-2">
		<h1 class="text-2xl font-bold text-gray-900">Summary</h1>
	</header>

	<!-- Quick Stats Grid (moved from home page) -->
	{#if quickStatsLoaded}
		<div class="grid grid-cols-2 gap-3">
			<div class="card">
				<p class="text-xs text-gray-500 uppercase tracking-wide">This Week</p>
				<p class="text-xl font-bold text-gray-900">{formatHours($stats.weeklyHours)}</p>
				<p class="text-sm text-green-600 font-medium">{formatCurrency($stats.weeklyEarnings)}</p>
			</div>
			<div class="card">
				<p class="text-xs text-gray-500 uppercase tracking-wide">This Month</p>
				<p class="text-xl font-bold text-gray-900">{formatHours($stats.monthlyHours)}</p>
				<p class="text-sm text-green-600 font-medium">{formatCurrency($stats.monthlyEarnings)}</p>
			</div>
			<div class="card">
				<p class="text-xs text-gray-500 uppercase tracking-wide">6 Months</p>
				<p class="text-xl font-bold text-gray-900">{formatHours(sixMonthHours)}</p>
				<p class="text-sm text-green-600 font-medium">{formatCurrency(sixMonthEarnings)}</p>
			</div>
			<div class="card">
				<p class="text-xs text-gray-500 uppercase tracking-wide">Year to Date</p>
				<p class="text-xl font-bold text-gray-900">{formatHours($stats.yearlyHours)}</p>
				<p class="text-sm text-green-600 font-medium">{formatCurrency($stats.yearlyEarnings)}</p>
			</div>
		</div>
	{/if}

	<!-- Period label -->
	<p class="text-center text-gray-600">{getPeriodLabel(selectedPeriod)}</p>

	<!-- Period filter -->
	<div class="flex gap-2">
		{#each ['week', 'month', 'quarter', 'year'] as period}
			<button
				onclick={() => selectedPeriod = period as Period}
				class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors
					{selectedPeriod === period
						? 'bg-blue-600 text-white'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
			>
				{period.charAt(0).toUpperCase() + period.slice(1)}
			</button>
		{/each}
	</div>

	<!-- Quick Stats from Home - Days Worked, Stat Holiday, Vacation, Sick -->
	<div class="grid grid-cols-2 gap-3">
		<!-- Days Worked -->
		<div class="card">
			<p class="text-xs text-gray-500 uppercase tracking-wide">Days Worked</p>
			<p class="text-xl font-bold text-gray-900">{daysWorkedThisPeriod}</p>
			<p class="text-xs text-gray-500">{currentPeriod.label}</p>
		</div>

		<!-- Stat Holiday -->
		<div class="card">
			<p class="text-xs text-gray-500 uppercase tracking-wide">Stat Holiday</p>
			{#if statStatus?.nextHoliday}
				<p class="text-xl font-bold text-gray-900">{statStatus.daysWorked}/{statStatus.daysRequired}</p>
				<p class="text-xs text-gray-500">{statStatus.nextHoliday.name}</p>
				{#if statStatus.qualifyingWindow}
					<p class="text-[10px] text-gray-400 mt-0.5">
						{new Date(statStatus.qualifyingWindow.start + 'T00:00:00').toLocaleDateString('default', { month: 'short', day: 'numeric' })} - {new Date(statStatus.qualifyingWindow.end + 'T00:00:00').toLocaleDateString('default', { month: 'short', day: 'numeric' })}
					</p>
				{/if}
			{:else}
				<p class="text-xl font-bold text-gray-900">--</p>
				<p class="text-xs text-gray-500">No upcoming</p>
			{/if}
		</div>

		<!-- Vacation Days -->
		<a href="/calendar?filter=vacation" class="card hover:bg-gray-50 transition-colors">
			<p class="text-xs text-gray-500 uppercase tracking-wide">Vacation Days</p>
			<p class="text-xl font-bold text-gray-900">{$vacationDaysYTD.length}</p>
			{#if $vacationDaysYTD.length > 0}
				<p class="text-xs text-gray-500 truncate">
					{$vacationDaysYTD.slice(0, 2).map(d => formatShortDate(d.date)).join(', ')}
					{$vacationDaysYTD.length > 2 ? '...' : ''}
				</p>
			{:else}
				<p class="text-xs text-gray-500">None this year</p>
			{/if}
		</a>

		<!-- Sick Days -->
		<a href="/calendar?filter=sick" class="card hover:bg-gray-50 transition-colors">
			<p class="text-xs text-gray-500 uppercase tracking-wide">Sick Days</p>
			<p class="text-xl font-bold text-gray-900">{$sickDaysYTD.length}</p>
			{#if $sickDaysYTD.length > 0}
				<p class="text-xs text-gray-500 truncate">
					{$sickDaysYTD.slice(0, 2).map(d => formatShortDate(d.date)).join(', ')}
					{$sickDaysYTD.length > 2 ? '...' : ''}
				</p>
			{:else}
				<p class="text-xs text-gray-500">None this year</p>
			{/if}
		</a>
	</div>

	<!-- Gross/Net Income Cards (YTD with BC Tax Estimates) -->
	{#if ytdEarnings > 0}
		<div class="card">
			<h3 class="font-semibold text-gray-900 mb-3">Year-to-Date Income</h3>
			<div class="grid grid-cols-2 gap-4">
				<div class="bg-gray-50 rounded-lg p-3 text-center">
					<p class="text-xs text-gray-500 uppercase tracking-wide">Gross</p>
					<p class="text-xl font-bold text-gray-900">{formatCurrency(ytdEarnings)}</p>
				</div>
				<div class="bg-green-50 rounded-lg p-3 text-center">
					<p class="text-xs text-gray-500 uppercase tracking-wide">Est. Net</p>
					<p class="text-xl font-bold text-green-600">
						{#if ytdTaxBreakdown}
							{formatCurrency(ytdEarnings * (1 - ytdTaxBreakdown.effectiveTaxRate / 100))}
						{:else}
							{formatCurrency(ytdEarnings)}
						{/if}
					</p>
				</div>
			</div>
			{#if ytdTaxBreakdown}
				<div class="mt-3 pt-3 border-t border-gray-100">
					<p class="text-xs text-gray-500 mb-2">Projected Annual Deductions (BC)</p>
					<div class="space-y-1 text-sm">
						<div class="flex justify-between">
							<span class="text-gray-600">Federal Tax</span>
							<span class="text-gray-900">{formatCurrency(ytdTaxBreakdown.federalTax)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">BC Provincial Tax</span>
							<span class="text-gray-900">{formatCurrency(ytdTaxBreakdown.provincialTax)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">CPP</span>
							<span class="text-gray-900">{formatCurrency(ytdTaxBreakdown.cpp)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-600">EI</span>
							<span class="text-gray-900">{formatCurrency(ytdTaxBreakdown.ei)}</span>
						</div>
						<div class="flex justify-between pt-2 border-t border-gray-100 font-medium">
							<span class="text-gray-700">Effective Tax Rate</span>
							<span class="text-gray-900">{ytdTaxBreakdown.effectiveTaxRate.toFixed(1)}%</span>
						</div>
					</div>
					<p class="text-xs text-gray-400 mt-2 italic">*Estimates based on projected annual income</p>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Pensionable Year Tracker -->
	{#if $user?.pension_target && $user.pension_target > 0}
		<div class="card">
			<div class="flex justify-between items-start mb-2">
				<h3 class="font-semibold text-gray-900">Pensionable Year</h3>
				<span class="text-sm text-gray-500">Target: {formatCurrency($user.pension_target)}</span>
			</div>
			<div class="progress-bar mb-2">
				<div
					class="progress-fill bg-green-500"
					style="width: {pensionProgress()}%"
				></div>
			</div>
			<p class="text-sm text-gray-600">
				{formatCurrency(totalEarnings)} / {formatCurrency($user.pension_target)}
				<span class="text-gray-400">({pensionProgress().toFixed(1)}%)</span>
			</p>
		</div>
	{/if}

	<!-- Career Total Card -->
	<div class="card">
		<p class="text-xs text-gray-500 uppercase tracking-wide">Career Total</p>
		<p class="text-xl font-bold text-gray-900">{formatHours(careerHours)}</p>
		<p class="text-sm text-gray-500">All time</p>
	</div>

	<!-- Entries list -->
	{#if periodEntries.length > 0}
		<div>
			<h3 class="text-lg font-semibold text-gray-900 mb-3">Entries</h3>
			<div class="space-y-2">
				{#each periodEntries as entry}
					<a href="/entry/{entry.id}" class="card block">
						<div class="flex justify-between items-start">
							<div>
								<p class="font-medium text-gray-900">{getJobName(entry)}</p>
								<p class="text-sm text-gray-500">
									{new Date(entry.date).toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' })}
									&middot; {entry.hours} hrs &middot; {entry.shift_type}
								</p>
								{#if entry.location || entry.ship}
									<p class="text-xs text-gray-400 mt-1">
										{entry.location}{entry.location && entry.ship ? ' - ' : ''}{entry.ship}
									</p>
								{/if}
							</div>
							<span class="text-green-600 font-semibold">{formatCurrency(entry.earnings || 0)}</span>
						</div>
					</a>
				{/each}
			</div>
		</div>
	{:else}
		<div class="card text-center py-6">
			<p class="text-gray-500">No entries for this period</p>
		</div>
	{/if}
</div>
