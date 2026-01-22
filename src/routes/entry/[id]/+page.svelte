<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { user, ratedJobs, entries, getHourlyRate, formatCurrency } from '$lib/stores';
	import { SHIFTS } from '$lib/db';
	import type { Entry, RatedJob } from '$lib/db';

	// Get entry ID from URL
	let entryId = $derived(parseInt($page.params.id));

	// Form state
	let loading = $state(true);
	let date = $state('');
	let shiftType = $state<'day' | 'afternoon' | 'graveyard'>('day');
	let jobType = $state<'rated' | 'hall'>('rated');
	let selectedRatedJobId = $state<number | null>(null);
	let hallJobName = $state('');
	let hours = $state(8);
	let location = $state('');
	let ship = $state('');
	let notes = $state('');

	// UI state
	let saving = $state(false);
	let deleting = $state(false);

	onMount(async () => {
		const entry = await entries.getById(entryId);
		if (!entry) {
			alert('Entry not found');
			goto('/calendar');
			return;
		}

		// Populate form
		date = entry.date;
		shiftType = entry.shift_type;
		jobType = entry.job_type;
		selectedRatedJobId = entry.rated_job_id;
		hallJobName = entry.hall_job_name || '';
		hours = entry.hours;
		location = entry.location || '';
		ship = entry.ship || '';
		notes = entry.notes || '';

		loading = false;
	});

	// Get selected rated job
	let selectedRatedJob = $derived<RatedJob | null>(
		selectedRatedJobId ? $ratedJobs.find(j => j.id === selectedRatedJobId) || null : null
	);

	// Calculate earnings
	let earnings = $derived(() => {
		const baseRate = getHourlyRate($user, shiftType);
		if (!baseRate) return 0;

		let totalHours = hours;
		let multiplier = 1;

		if (jobType === 'rated' && selectedRatedJob) {
			if (selectedRatedJob.has_extra_hour) {
				totalHours += 1;
			}
			if (selectedRatedJob.is_big_hour) {
				multiplier = 1.5;
			}
		}

		return totalHours * baseRate * multiplier;
	});

	// Validation
	let isValid = $derived(() => {
		if (!date) return false;
		if (hours <= 0) return false;
		if (jobType === 'rated' && !selectedRatedJobId) return false;
		if (jobType === 'hall' && !hallJobName.trim()) return false;
		return true;
	});

	async function updateEntry() {
		if (!isValid() || saving) return;

		saving = true;
		try {
			await entries.update({
				id: entryId,
				date,
				shift_type: shiftType,
				job_type: jobType,
				rated_job_id: jobType === 'rated' ? selectedRatedJobId : null,
				hall_job_name: jobType === 'hall' ? hallJobName.trim() : null,
				hours,
				location: location.trim() || null,
				ship: ship.trim() || null,
				notes: notes.trim() || null,
				earnings: earnings()
			});

			goto('/calendar');
		} catch (error) {
			console.error('Failed to update entry:', error);
			alert('Failed to update entry. Please try again.');
		} finally {
			saving = false;
		}
	}

	async function deleteEntry() {
		if (!confirm('Are you sure you want to delete this entry?')) return;

		deleting = true;
		try {
			await entries.remove(entryId);
			goto('/calendar');
		} catch (error) {
			console.error('Failed to delete entry:', error);
			alert('Failed to delete entry. Please try again.');
		} finally {
			deleting = false;
		}
	}
</script>

{#if loading}
	<div class="min-h-screen flex items-center justify-center">
		<div class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
	</div>
{:else}
	<div class="p-4 pb-32 space-y-4">
		<header class="flex items-center justify-between mb-6">
			<div>
				<h1 class="text-2xl font-bold text-gray-900">Edit Entry</h1>
				<p class="text-gray-600">Update your work shift</p>
			</div>
			<button
				onclick={deleteEntry}
				disabled={deleting}
				class="p-2 text-red-500 hover:bg-red-50 rounded-lg"
			>
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
					<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
				</svg>
			</button>
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

		<!-- Shift type toggle -->
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

		<!-- Job type toggle -->
		<div class="card">
			<label class="block text-sm font-medium text-gray-700 mb-2">Job Type</label>
			<div class="grid grid-cols-2 gap-2 mb-3">
				<button
					onclick={() => jobType = 'rated'}
					class="py-3 rounded-lg font-medium transition-colors {jobType === 'rated'
						? 'bg-blue-600 text-white'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				>
					Rated Job
				</button>
				<button
					onclick={() => jobType = 'hall'}
					class="py-3 rounded-lg font-medium transition-colors {jobType === 'hall'
						? 'bg-blue-600 text-white'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				>
					Hall Job
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
								{#if job.has_extra_hour || job.is_big_hour}
									({job.has_extra_hour ? '+1hr' : ''}{job.has_extra_hour && job.is_big_hour ? ', ' : ''}{job.is_big_hour ? '1.5x' : ''})
								{/if}
							</option>
						{/each}
					</select>
				{:else}
					<p class="text-sm text-gray-500 text-center py-2">
						No rated jobs configured. <a href="/settings" class="text-blue-600">Add jobs in settings</a>
					</p>
				{/if}
			{:else}
				<input
					type="text"
					bind:value={hallJobName}
					placeholder="Enter job name"
					class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			{/if}
		</div>

		<!-- Hours -->
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
	<div class="fixed bottom-16 left-0 right-0 p-4 bg-white border-t border-gray-200">
		<div class="flex items-center justify-between mb-3">
			<span class="text-gray-600">Estimated Earnings</span>
			<span class="text-2xl font-bold text-green-600">{formatCurrency(earnings())}</span>
		</div>
		<div class="flex gap-3">
			<button
				onclick={() => goto('/calendar')}
				class="flex-1 py-4 border border-gray-300 text-gray-700 rounded-xl font-semibold"
			>
				Cancel
			</button>
			<button
				onclick={updateEntry}
				disabled={!isValid() || saving}
				class="flex-1 py-4 bg-blue-600 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{saving ? 'Saving...' : 'Update Entry'}
			</button>
		</div>
	</div>
{/if}
