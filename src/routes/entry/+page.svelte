<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { user, ratedJobs, entries, getHourlyRate, formatCurrency, timeOff } from '$lib/stores';
	import { SHIFTS } from '$lib/db';
	import type { RatedJob } from '$lib/db';

	// Get date from URL query param or use today
	const urlDate = $page.url.searchParams.get('date');

	// Form state
	let date = $state(urlDate || new Date().toISOString().split('T')[0]);
	let shiftType = $state<'day' | 'afternoon' | 'graveyard'>('day');
	let jobType = $state<'rated' | 'hall' | 'sick' | 'vacation'>('rated');
	let selectedRatedJobId = $state<number | null>(null);
	let hallJobName = $state('');
	let hours = $state(SHIFTS.day.defaultHours);
	let location = $state('');
	let ship = $state('');
	let notes = $state('');

	// UI state
	let saving = $state(false);
	let showSuccess = $state(false);
	let savedEarnings = $state(0);

	// Update hours when shift type changes
	$effect(() => {
		hours = SHIFTS[shiftType].defaultHours;
	});

	// Get selected rated job
	let selectedRatedJob = $derived<RatedJob | null>(
		selectedRatedJobId ? $ratedJobs.find(j => j.id === selectedRatedJobId) || null : null
	);

	// Calculate earnings and total hours
	let calculatedHours = $derived(() => {
		let totalHours = hours;

		// Apply rated job modifiers to hours
		if (jobType === 'rated' && selectedRatedJob) {
			if (selectedRatedJob.has_extra_hour) {
				totalHours += 1;
			}
			if (selectedRatedJob.is_big_hour) {
				totalHours += 1; // Big hour also adds 1 hour to total
			}
			if (selectedRatedJob.has_meal_hour) {
				totalHours += 0.5;
			}
		}

		return totalHours;
	});

	let earnings = $derived(() => {
		const baseRate = getHourlyRate($user, shiftType);
		if (!baseRate) return 0;

		let payableHours = hours;
		let bonusPay = 0;

		// Apply rated job modifiers
		if (jobType === 'rated' && selectedRatedJob) {
			if (selectedRatedJob.has_extra_hour) {
				payableHours += 1;
			}
			if (selectedRatedJob.is_big_hour) {
				// Big hour pays 1.5x for 1 extra hour
				bonusPay += baseRate * 1.5;
			}
			if (selectedRatedJob.has_meal_hour) {
				payableHours += 0.5;
			}
		}

		return (payableHours * baseRate) + bonusPay;
	});

	// Validation
	let isValid = $derived(() => {
		if (!date) return false;
		// Sick and vacation don't need hours or job selection
		if (jobType === 'sick' || jobType === 'vacation') return true;
		if (hours <= 0) return false;
		if (jobType === 'rated' && !selectedRatedJobId) return false;
		if (jobType === 'hall' && !hallJobName.trim()) return false;
		return true;
	});

	// Check if this is a time off type
	let isTimeOff = $derived(() => jobType === 'sick' || jobType === 'vacation');

	async function saveEntry() {
		if (!isValid() || saving) return;

		saving = true;
		try {
			if (jobType === 'sick' || jobType === 'vacation') {
				// Save to time_off table
				await timeOff.add({
					date,
					type: jobType,
					notes: notes.trim() || null
				});

				// Show success message (no earnings for time off)
				savedEarnings = 0;
				showSuccess = true;

				// Reset form after delay
				setTimeout(() => {
					showSuccess = false;
					resetForm();
				}, 2000);
			} else {
				// Save to entries table
				const calculatedEarnings = earnings();
				const totalHours = calculatedHours();

				await entries.add({
					date,
					shift_type: shiftType,
					job_type: jobType,
					rated_job_id: jobType === 'rated' ? selectedRatedJobId : null,
					hall_job_name: jobType === 'hall' ? hallJobName.trim() : null,
					hours: totalHours,
					location: location.trim() || null,
					ship: ship.trim() || null,
					notes: notes.trim() || null,
					earnings: calculatedEarnings
				});

				// Show success message
				savedEarnings = calculatedEarnings;
				showSuccess = true;

				// Reset form after delay
				setTimeout(() => {
					showSuccess = false;
					resetForm();
				}, 2000);
			}
		} catch (error) {
			console.error('Failed to save entry:', error);
			alert('Failed to save entry. Please try again.');
		} finally {
			saving = false;
		}
	}

	function resetForm() {
		date = new Date().toISOString().split('T')[0];
		shiftType = 'day';
		jobType = 'rated';
		selectedRatedJobId = null;
		hallJobName = '';
		hours = SHIFTS.day.defaultHours;
		location = '';
		ship = '';
		notes = '';
	}
</script>

<!-- Success overlay -->
{#if showSuccess}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div class="bg-white rounded-2xl p-8 text-center mx-4 animate-bounce-in">
			{#if jobType === 'vacation'}
				<div class="text-5xl mb-4">🏖️</div>
				<h2 class="text-2xl font-bold text-amber-600 mb-2">Vacation Day</h2>
				<p class="text-gray-600">logged successfully!</p>
			{:else if jobType === 'sick'}
				<div class="text-5xl mb-4">🤒</div>
				<h2 class="text-2xl font-bold text-red-600 mb-2">Sick Day</h2>
				<p class="text-gray-600">logged successfully!</p>
			{:else}
				<div class="text-5xl mb-4">💰</div>
				<h2 class="text-2xl font-bold text-green-600 mb-2">{formatCurrency(savedEarnings)}</h2>
				<p class="text-gray-600">earned today!</p>
			{/if}
		</div>
	</div>
{/if}

<div class="p-4 pb-32 space-y-4">
	<header class="mb-6">
		<h1 class="text-2xl font-bold text-gray-900">Add Entry</h1>
		<p class="text-gray-600">Log your work shift</p>
	</header>

	<!-- Date picker -->
	<div class="card">
		<label for="date" class="block text-sm font-medium text-gray-700 mb-2">Date</label>
		<input
			id="date"
			type="date"
			bind:value={date}
			class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
		/>
	</div>

	<!-- Shift type toggle (hidden for time off) -->
	{#if !isTimeOff()}
		<div class="card">
			<label class="block text-sm font-medium text-gray-700 mb-2">Shift Type</label>
			<div class="grid grid-cols-3 gap-2">
				{#each Object.entries(SHIFTS) as [key, shift]}
					<button
						onclick={() => shiftType = key as 'day' | 'afternoon' | 'graveyard'}
						class="py-3 px-2 rounded-lg text-center transition-colors {shiftType === key
							? 'bg-blue-600 text-white'
							: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					>
						<div class="font-medium text-sm">{shift.name}</div>
						<div class="text-xs opacity-75">{shift.defaultHours} hrs</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Job type toggle -->
	<div class="card">
		<label class="block text-sm font-medium text-gray-700 mb-2">Job Type</label>
		<div class="grid grid-cols-4 gap-2 mb-3">
			<button
				onclick={() => jobType = 'rated'}
				class="col-span-1 py-3 rounded-lg font-medium transition-colors text-sm {jobType === 'rated'
					? 'bg-blue-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
			>
				Rated Job
			</button>
			<button
				onclick={() => jobType = 'hall'}
				class="col-span-1 py-3 rounded-lg font-medium transition-colors text-sm {jobType === 'hall'
					? 'bg-blue-600 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
			>
				Hall Job
			</button>
			<button
				onclick={() => jobType = 'sick'}
				class="col-span-1 py-3 rounded-lg font-medium transition-colors text-sm {jobType === 'sick'
					? 'bg-red-500 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
			>
				🤒 Sick
			</button>
			<button
				onclick={() => jobType = 'vacation'}
				class="col-span-1 py-3 rounded-lg font-medium transition-colors text-sm {jobType === 'vacation'
					? 'bg-amber-500 text-white'
					: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
			>
				🏖️ Vacation
			</button>
		</div>

		{#if jobType === 'rated'}
			{#if $ratedJobs.length > 0}
				<select
					bind:value={selectedRatedJobId}
					class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				>
					<option value={null}>Select a rated job...</option>
					{#each $ratedJobs as job}
						<option value={job.id}>
							{job.name}
							{#if job.has_extra_hour || job.is_big_hour || job.has_meal_hour}
								({job.has_extra_hour ? '+1hr' : ''}{job.has_extra_hour && (job.is_big_hour || job.has_meal_hour) ? ', ' : ''}{job.is_big_hour ? '1.5x' : ''}{job.is_big_hour && job.has_meal_hour ? ', ' : ''}{job.has_meal_hour ? '+meal' : ''})
							{/if}
						</option>
					{/each}
				</select>
			{:else}
				<p class="text-sm text-gray-500 text-center py-2">
					No rated jobs configured. <a href="/settings" class="text-blue-600">Add jobs in settings</a>
				</p>
			{/if}
		{:else if jobType === 'hall'}
			<input
				type="text"
				bind:value={hallJobName}
				placeholder="Enter job name"
				class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			/>
		{:else if jobType === 'sick' || jobType === 'vacation'}
			<p class="text-sm text-gray-500 text-center py-2">
				{jobType === 'sick' ? '🤒 Recording sick day' : '🏖️ Recording vacation day'} for {new Date(date + 'T00:00:00').toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' })}
			</p>
		{/if}
	</div>

	<!-- Hours (hidden for time off) -->
	{#if !isTimeOff()}
		<div class="card">
			<label for="hours" class="block text-sm font-medium text-gray-700 mb-2">Hours Worked</label>
			<input
				id="hours"
				type="number"
				step="0.5"
				min="0"
				bind:value={hours}
				class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
			/>
		</div>

		<!-- Location & Ship -->
		<div class="grid grid-cols-2 gap-3">
			<div class="card">
				<label for="location" class="block text-sm font-medium text-gray-700 mb-2">Location</label>
				<input
					id="location"
					type="text"
					bind:value={location}
					placeholder="Optional"
					class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>
			<div class="card">
				<label for="ship" class="block text-sm font-medium text-gray-700 mb-2">Ship</label>
				<input
					id="ship"
					type="text"
					bind:value={ship}
					placeholder="Optional"
					class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>
		</div>
	{/if}

	<!-- Notes -->
	<div class="card">
		<label for="notes" class="block text-sm font-medium text-gray-700 mb-2">Notes</label>
		<textarea
			id="notes"
			bind:value={notes}
			placeholder="Any additional notes..."
			rows="3"
			class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
		></textarea>
	</div>
</div>

<!-- Earnings preview & save button -->
<div class="fixed left-0 right-0 p-4 bg-white border-t border-gray-200 bottom-navbar">
	{#if isTimeOff()}
		<div class="flex items-center justify-center mb-3">
			<span class="text-xl font-medium {jobType === 'vacation' ? 'text-amber-600' : 'text-red-600'}">
				{jobType === 'vacation' ? '🏖️ Vacation Day' : '🤒 Sick Day'}
			</span>
		</div>
		<button
			onclick={saveEntry}
			disabled={!isValid() || saving}
			class="w-full py-4 rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed
				{jobType === 'vacation' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'}"
		>
			{saving ? 'Saving...' : `Log ${jobType === 'vacation' ? 'Vacation' : 'Sick'} Day`}
		</button>
	{:else}
		<div class="flex items-center justify-between mb-3">
			<span class="text-gray-600">Estimated Earnings</span>
			<span class="text-2xl font-bold text-green-600">{formatCurrency(earnings())}</span>
		</div>
		<button
			onclick={saveEntry}
			disabled={!isValid() || saving}
			class="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
		>
			{saving ? 'Saving...' : 'Save Entry'}
		</button>
	{/if}
</div>

<style>
	@keyframes bounce-in {
		0% { transform: scale(0.5); opacity: 0; }
		50% { transform: scale(1.1); }
		100% { transform: scale(1); opacity: 1; }
	}

	.animate-bounce-in {
		animation: bounce-in 0.3s ease-out;
	}

	.bottom-navbar {
		bottom: calc(4rem + env(safe-area-inset-bottom));
	}
</style>
