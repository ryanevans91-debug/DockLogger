<script lang="ts">
	import { onMount } from 'svelte';
	import { documents, documentCounts, user } from '$lib/stores';
	import { Filesystem, Directory } from '@capacitor/filesystem';
	import type { Document } from '$lib/db';
	import { parsePaystubWithGemini, getGeminiApiKey, type ParsedPaystubData } from '$lib/utils/gemini';

	let loading = $state(true);
	let selectedCategory = $state<string | null>(null);
	let showUploadModal = $state(false);
	let showVerifyModal = $state(false);
	let uploadedFile = $state<{ name: string; data: string; mimeType: string } | null>(null);
	let extractedData = $state<Record<string, string | number | null>>({});
	let parsingWithAI = $state(false);
	let docName = $state('');
	let docCategory = $state('timesheet');
	let docNotes = $state('');
	let saving = $state(false);

	const categories = [
		{ value: 'manning_sheet', label: 'Manning Sheets', icon: 'clipboard' },
		{ value: 'toolbox_talk', label: 'Toolbox Talks', icon: 'chat' },
		{ value: 'vacation_pay', label: 'Vacation Pay', icon: 'calendar' },
		{ value: 'pay_stub', label: 'Pay Stubs', icon: 'currency' },
		{ value: 'timesheet', label: 'Timesheets', icon: 'clock' },
		{ value: 'other', label: 'Other', icon: 'document' }
	];

	onMount(async () => {
		await documents.load();
		loading = false;
	});

	function filteredDocuments(docs: Document[]) {
		if (!selectedCategory) return docs;
		return docs.filter(d => d.category === selectedCategory);
	}

	async function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (e) => {
			const data = e.target?.result as string;
			uploadedFile = {
				name: file.name,
				data,
				mimeType: file.type
			};

			// Auto-generate document name from filename
			docName = file.name.replace(/\.[^/.]+$/, '');

			showUploadModal = false;

			// Try to extract data from the document using AI
			extractedData = await extractDocumentData(data, file.type);

			// Show verification modal if data was extracted
			if (Object.keys(extractedData).length > 0) {
				showVerifyModal = true;
			} else if (docCategory === 'pay_stub' && !getGeminiApiKey($user?.gemini_api_key)) {
				// If it's a paystub but no API key, prompt user
				alert('Add your Gemini API key in Settings to automatically extract paystub data.');
			}
		};
		reader.readAsDataURL(file);
	}

	async function extractDocumentData(data: string, mimeType: string): Promise<Record<string, string | number | null>> {
		// Only process paystubs with AI
		if (docCategory !== 'pay_stub') {
			return {};
		}

		// Check if we have Gemini API key (user's or from env)
		const apiKey = getGeminiApiKey($user?.gemini_api_key);
		if (!apiKey) {
			return {};
		}

		parsingWithAI = true;
		try {
			const result = await parsePaystubWithGemini(apiKey, data);
			if (result.success && result.data && !Array.isArray(result.data)) {
				const paystubData = result.data as ParsedPaystubData;
				// Convert to display-friendly format
				const extracted: Record<string, string | number | null> = {};
				if (paystubData.gross_pay) extracted['Gross Pay'] = `$${paystubData.gross_pay.toFixed(2)}`;
				if (paystubData.net_pay) extracted['Net Pay'] = `$${paystubData.net_pay.toFixed(2)}`;
				if (paystubData.federal_tax) extracted['Federal Tax'] = `$${paystubData.federal_tax.toFixed(2)}`;
				if (paystubData.provincial_tax) extracted['Provincial Tax'] = `$${paystubData.provincial_tax.toFixed(2)}`;
				if (paystubData.cpp) extracted['CPP'] = `$${paystubData.cpp.toFixed(2)}`;
				if (paystubData.ei) extracted['EI'] = `$${paystubData.ei.toFixed(2)}`;
				if (paystubData.union_dues) extracted['Union Dues'] = `$${paystubData.union_dues.toFixed(2)}`;
				if (paystubData.pension_contribution) extracted['Pension'] = `$${paystubData.pension_contribution.toFixed(2)}`;
				if (paystubData.hours_worked) extracted['Hours Worked'] = paystubData.hours_worked;
				if (paystubData.pay_period_start) extracted['Period Start'] = paystubData.pay_period_start;
				if (paystubData.pay_period_end) extracted['Period End'] = paystubData.pay_period_end;
				return extracted;
			}
		} catch (error) {
			console.error('AI extraction error:', error);
		} finally {
			parsingWithAI = false;
		}
		return {};
	}

	async function saveUploadedDocument() {
		if (!uploadedFile || !docName.trim() || saving) return;

		saving = true;

		try {
			// Save file to filesystem
			const ext = uploadedFile.mimeType.includes('pdf') ? 'pdf' : 'jpg';
			const fileName = `doc_${Date.now()}.${ext}`;
			const savedFile = await Filesystem.writeFile({
				path: `documents/${fileName}`,
				data: uploadedFile.data,
				directory: Directory.Data,
				recursive: true
			});

			// Save to database
			await documents.add({
				name: docName.trim(),
				type: uploadedFile.mimeType.includes('pdf') ? 'pdf' : 'image',
				file_path: savedFile.uri || `documents/${fileName}`,
				file_size: null,
				mime_type: uploadedFile.mimeType,
				category: docCategory as any,
				extracted_data: Object.keys(extractedData).length > 0 ? JSON.stringify(extractedData) : null,
				notes: docNotes.trim() || null
			});

			// Reset form
			uploadedFile = null;
			docName = '';
			docCategory = 'timesheet';
			docNotes = '';
			extractedData = {};
			showVerifyModal = false;
		} catch (error) {
			console.error('Save error:', error);
			alert('Failed to save document. Please try again.');
		} finally {
			saving = false;
		}
	}

	async function deleteDocument(doc: Document) {
		if (!confirm(`Delete "${doc.name}"?`)) return;

		try {
			// Delete from filesystem
			try {
				await Filesystem.deleteFile({
					path: doc.file_path,
					directory: Directory.Data
				});
			} catch {
				// File might not exist, continue anyway
			}

			// Delete from database
			await documents.remove(doc.id);
		} catch (error) {
			console.error('Delete error:', error);
			alert('Failed to delete document.');
		}
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('default', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="p-4 pb-24 space-y-4">
	<header class="flex items-center justify-between mb-4">
		<div class="flex items-center gap-3">
			<a href="/" class="p-2 -ml-2 text-gray-500 hover:text-gray-700">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
				</svg>
			</a>
			<h1 class="text-2xl font-bold text-gray-900">Documents</h1>
		</div>
		<button
			onclick={() => showUploadModal = true}
			class="p-2 bg-blue-600 text-white rounded-lg"
		>
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
			</svg>
		</button>
	</header>

	{#if loading}
		<div class="flex justify-center py-8">
			<div class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
		</div>
	{:else}
		<!-- Category Filter -->
		<div class="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
			<button
				onclick={() => selectedCategory = null}
				class="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
					{selectedCategory === null ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}"
			>
				All ({$documents.length})
			</button>
			{#each categories as cat}
				{#if $documentCounts[cat.value] > 0}
					<button
						onclick={() => selectedCategory = cat.value}
						class="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
							{selectedCategory === cat.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}"
					>
						{cat.label} ({$documentCounts[cat.value]})
					</button>
				{/if}
			{/each}
		</div>

		<!-- Documents List -->
		{#if filteredDocuments($documents).length === 0}
			<div class="card text-center py-8">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12 mx-auto text-gray-300 mb-3">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
				</svg>
				<p class="text-gray-500">No documents yet</p>
				<p class="text-sm text-gray-400 mt-1">Use the camera to capture documents</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each filteredDocuments($documents) as doc}
					<div class="card flex items-center gap-3">
						<div class="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
							{#if doc.type === 'pdf'}
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-red-500">
									<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
								</svg>
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-blue-500">
									<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
								</svg>
							{/if}
						</div>
						<div class="flex-1 min-w-0">
							<h3 class="font-medium text-gray-900 truncate">{doc.name}</h3>
							<p class="text-sm text-gray-500">{formatDate(doc.created_at)}</p>
							{#if doc.category}
								<span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
									{categories.find(c => c.value === doc.category)?.label || doc.category}
								</span>
							{/if}
						</div>
						<button
							onclick={() => deleteDocument(doc)}
							class="p-2 text-red-500 hover:text-red-700"
						>
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
								<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<!-- Upload Modal -->
{#if showUploadModal}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
		<div class="card w-full max-w-sm">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">Upload Document</h2>
			<p class="text-sm text-gray-600 mb-4">Upload timesheets, pay stubs, or other work documents</p>

			<label class="block w-full py-8 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8 mx-auto text-gray-400 mb-2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
				</svg>
				<span class="text-sm text-gray-600">Tap to select file</span>
				<input
					type="file"
					accept="image/*,.pdf"
					onchange={handleFileUpload}
					class="hidden"
				/>
			</label>

			<button
				onclick={() => showUploadModal = false}
				class="w-full mt-4 py-2 border border-gray-300 rounded-lg text-gray-700"
			>
				Cancel
			</button>
		</div>
	</div>
{/if}

<!-- Verify Extracted Data Modal -->
{#if showVerifyModal && uploadedFile}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
		<div class="card w-full max-w-sm max-h-[80vh] overflow-y-auto">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">Verify Document</h2>

			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Document Name</label>
					<input
						type="text"
						bind:value={docName}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
					<select
						bind:value={docCategory}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
					>
						{#each categories as cat}
							<option value={cat.value}>{cat.label}</option>
						{/each}
					</select>
				</div>

				{#if Object.keys(extractedData).length > 0}
					<div class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
						<p class="text-sm font-medium text-amber-800 mb-2">Extracted Information</p>
						{#each Object.entries(extractedData) as [key, value]}
							<div class="flex justify-between text-sm">
								<span class="text-gray-600">{key}:</span>
								<span class="text-gray-900">{value}</span>
							</div>
						{/each}
					</div>
				{/if}

				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
					<textarea
						bind:value={docNotes}
						rows="2"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
					></textarea>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-3 mt-6">
				<button
					onclick={() => { showVerifyModal = false; uploadedFile = null; }}
					class="py-2 border border-gray-300 rounded-lg text-gray-700"
				>
					Cancel
				</button>
				<button
					onclick={saveUploadedDocument}
					disabled={!docName.trim() || saving}
					class="py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}
