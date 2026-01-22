<script lang="ts">
	import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
	import { Filesystem, Directory } from '@capacitor/filesystem';
	import { goto } from '$app/navigation';
	import { documents } from '$lib/stores';

	let capturedImage = $state<string | null>(null);
	let selectedCategory = $state<string>('manning_sheet');
	let docName = $state('');
	let notes = $state('');
	let saving = $state(false);

	const categories = [
		{ value: 'manning_sheet', label: 'Manning Sheet' },
		{ value: 'toolbox_talk', label: 'Toolbox Talk' },
		{ value: 'vacation_pay', label: 'Vacation Pay' },
		{ value: 'pay_stub', label: 'Pay Stub' },
		{ value: 'timesheet', label: 'Timesheet' },
		{ value: 'other', label: 'Other' }
	];

	async function takePhoto() {
		try {
			const photo = await Camera.getPhoto({
				quality: 90,
				allowEditing: false,
				resultType: CameraResultType.DataUrl,
				source: CameraSource.Camera
			});

			if (photo.dataUrl) {
				capturedImage = photo.dataUrl;
				// Generate default name based on category and date
				const date = new Date().toLocaleDateString('en-CA');
				const categoryLabel = categories.find(c => c.value === selectedCategory)?.label || 'Document';
				docName = `${categoryLabel} - ${date}`;
			}
		} catch (error) {
			console.error('Camera error:', error);
			// User cancelled or error occurred
		}
	}

	async function pickFromGallery() {
		try {
			const photo = await Camera.getPhoto({
				quality: 90,
				allowEditing: false,
				resultType: CameraResultType.DataUrl,
				source: CameraSource.Photos
			});

			if (photo.dataUrl) {
				capturedImage = photo.dataUrl;
				const date = new Date().toLocaleDateString('en-CA');
				const categoryLabel = categories.find(c => c.value === selectedCategory)?.label || 'Document';
				docName = `${categoryLabel} - ${date}`;
			}
		} catch (error) {
			console.error('Gallery error:', error);
		}
	}

	async function saveDocument() {
		if (!capturedImage || !docName.trim() || saving) return;

		saving = true;

		try {
			// Save image to filesystem
			const fileName = `doc_${Date.now()}.jpg`;
			const savedFile = await Filesystem.writeFile({
				path: `documents/${fileName}`,
				data: capturedImage,
				directory: Directory.Data,
				recursive: true
			});

			// Save to database
			await documents.add({
				name: docName.trim(),
				type: 'image',
				file_path: savedFile.uri || `documents/${fileName}`,
				file_size: null,
				mime_type: 'image/jpeg',
				category: selectedCategory as any,
				extracted_data: null,
				notes: notes.trim() || null
			});

			// Navigate to documents page
			goto('/documents');
		} catch (error) {
			console.error('Save error:', error);
			alert('Failed to save document. Please try again.');
		} finally {
			saving = false;
		}
	}

	function retake() {
		capturedImage = null;
		docName = '';
		notes = '';
	}
</script>

<div class="p-4 pb-24 space-y-4">
	<header class="flex items-center gap-3 mb-4">
		<a href="/" class="p-2 -ml-2 text-gray-500 hover:text-gray-700">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
			</svg>
		</a>
		<h1 class="text-2xl font-bold text-gray-900">Camera</h1>
	</header>

	{#if !capturedImage}
		<!-- Camera/Gallery Selection -->
		<div class="space-y-4">
			<p class="text-gray-600 text-center">Capture manning sheets, toolbox talks, and other work documents</p>

			<!-- Category Selection First -->
			<div class="card">
				<label class="block font-medium text-gray-900 mb-2">Document Type</label>
				<select
					bind:value={selectedCategory}
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
				>
					{#each categories as cat}
						<option value={cat.value}>{cat.label}</option>
					{/each}
				</select>
			</div>

			<div class="grid grid-cols-2 gap-3">
				<button
					onclick={takePhoto}
					class="card-elevated py-8 flex flex-col items-center gap-3 hover:bg-gray-50 transition-colors"
				>
					<div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8 text-blue-600">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
						</svg>
					</div>
					<span class="font-medium text-gray-900">Take Photo</span>
				</button>

				<button
					onclick={pickFromGallery}
					class="card-elevated py-8 flex flex-col items-center gap-3 hover:bg-gray-50 transition-colors"
				>
					<div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8 text-purple-600">
							<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
						</svg>
					</div>
					<span class="font-medium text-gray-900">From Gallery</span>
				</button>
			</div>
		</div>
	{:else}
		<!-- Image Preview & Save Form -->
		<div class="space-y-4">
			<!-- Image Preview -->
			<div class="card p-2">
				<img
					src={capturedImage}
					alt="Captured document"
					class="w-full rounded-lg"
				/>
			</div>

			<!-- Document Details Form -->
			<div class="card space-y-4">
				<div>
					<label for="docName" class="block font-medium text-gray-900 mb-1">Document Name</label>
					<input
						id="docName"
						type="text"
						bind:value={docName}
						placeholder="Enter document name"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					/>
				</div>

				<div>
					<label for="category" class="block font-medium text-gray-900 mb-1">Category</label>
					<select
						id="category"
						bind:value={selectedCategory}
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					>
						{#each categories as cat}
							<option value={cat.value}>{cat.label}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="notes" class="block font-medium text-gray-900 mb-1">Notes (optional)</label>
					<textarea
						id="notes"
						bind:value={notes}
						placeholder="Add any notes..."
						rows="2"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					></textarea>
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="grid grid-cols-2 gap-3">
				<button
					onclick={retake}
					class="py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
				>
					Retake
				</button>
				<button
					onclick={saveDocument}
					disabled={!docName.trim() || saving}
					class="py-3 bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50"
				>
					{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	{/if}
</div>
