/**
 * Simple test utilities for filesystem operations
 * This file provides basic tests that can be run in the browser console
 */

import { 
  openWorkspace, 
  restoreWorkspace, 
  buildFileTree, 
  readFile, 
  writeFile,
  createFile,
  createDirectory,
  deleteEntry,
  readFileIcon,
  updateFileIcon
} from './filesystem';

/**
 * Test opening a workspace
 */
export async function testOpenWorkspace() {
  console.log('🧪 Testing openWorkspace()...');
  try {
    const handle = await openWorkspace();
    console.log('✅ Workspace opened:', handle.name);
    return handle;
  } catch (error) {
    console.error('❌ Failed to open workspace:', error);
    throw error;
  }
}

/**
 * Test restoring a workspace
 */
export async function testRestoreWorkspace() {
  console.log('🧪 Testing restoreWorkspace()...');
  try {
    const handle = await restoreWorkspace();
    if (handle) {
      console.log('✅ Workspace restored:', handle.name);
      return handle;
    } else {
      console.log('⚠️ No workspace to restore');
      return null;
    }
  } catch (error) {
    console.error('❌ Failed to restore workspace:', error);
    throw error;
  }
}

/**
 * Test building file tree
 */
export async function testBuildFileTree(handle: FileSystemDirectoryHandle) {
  console.log('🧪 Testing buildFileTree()...');
  try {
    const tree = await buildFileTree(handle);
    console.log('✅ File tree built:', tree.length, 'entries');
    console.log(JSON.stringify(tree.map(n => ({ name: n.name, kind: n.kind, children: n.children?.length })), null, 2));
    return tree;
  } catch (error) {
    console.error('❌ Failed to build file tree:', error);
    throw error;
  }
}

/**
 * Test reading and writing a file
 */
export async function testReadWriteFile(handle: FileSystemDirectoryHandle) {
  console.log('🧪 Testing readFile() and writeFile()...');
  try {
    // Create a test file
    const testFileName = `test-${Date.now()}.md`;
    const fileHandle = await createFile(handle, testFileName);
    console.log('✅ Created test file:', testFileName);

    // Write content
    const testContent = '# Test File\n\nThis is a test file created at ' + new Date().toISOString();
    await writeFile(fileHandle, testContent);
    console.log('✅ Wrote content to file');

    // Read content back
    const readContent = await readFile(fileHandle);
    console.log('✅ Read content from file');

    // Verify
    if (readContent === testContent) {
      console.log('✅ Content matches!');
    } else {
      console.error('❌ Content mismatch!');
      console.log('Expected:', testContent);
      console.log('Got:', readContent);
    }

    // Clean up
    await deleteEntry(handle, testFileName);
    console.log('✅ Deleted test file');

    return true;
  } catch (error) {
    console.error('❌ Failed read/write test:', error);
    throw error;
  }
}

/**
 * Test creating and deleting a directory
 */
export async function testCreateDeleteDirectory(handle: FileSystemDirectoryHandle) {
  console.log('🧪 Testing createDirectory() and deleteEntry()...');
  try {
    const dirName = `test-dir-${Date.now()}`;
    const dirHandle = await createDirectory(handle, dirName);
    console.log('✅ Created test directory:', dirName);

    // Create a file inside
    const fileHandle = await createFile(dirHandle, 'nested-test.md');
    await writeFile(fileHandle, '# Nested Test\n\nThis file is in a subdirectory');
    console.log('✅ Created file in directory');

    // Delete the directory (should be recursive)
    await deleteEntry(handle, dirName);
    console.log('✅ Deleted test directory');

    return true;
  } catch (error) {
    console.error('❌ Failed directory test:', error);
    throw error;
  }
}

/**
 * Test icon extraction from front-matter
 */
export function testReadFileIcon() {
  console.log('🧪 Testing readFileIcon()...');
  
  const testCases = [
    {
      content: '---\nicon: 📝\ntitle: Test\n---\n\n# Content',
      expected: '📝',
    },
    {
      content: '---\ntitle: Test\nicon: 🚀\n---\n\n# Content',
      expected: '🚀',
    },
    {
      content: '# No front-matter',
      expected: undefined,
    },
    {
      content: '---\ntitle: Test\n---\n\n# No icon',
      expected: undefined,
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const { content, expected } of testCases) {
    const result = readFileIcon(content);
    if (result === expected) {
      console.log('✅ Test passed:', expected || 'undefined');
      passed++;
    } else {
      console.error('❌ Test failed. Expected:', expected, 'Got:', result);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

/**
 * Test icon updating in front-matter
 */
export function testUpdateFileIcon() {
  console.log('🧪 Testing updateFileIcon()...');
  
  const testCases = [
    {
      name: 'Add icon to no front-matter',
      content: '# Content',
      icon: '📝',
      expected: '---\nicon: 📝\n---\n\n# Content',
    },
    {
      name: 'Update existing icon',
      content: '---\nicon: 📝\ntitle: Test\n---\n\n# Content',
      icon: '🚀',
      expected: '---\nicon: 🚀\ntitle: Test\n---\n\n# Content',
    },
    {
      name: 'Add icon to existing front-matter',
      content: '---\ntitle: Test\n---\n\n# Content',
      icon: '📌',
      expected: '---\ntitle: Test\nicon: 📌\n---\n\n# Content',
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const { name, content, icon, expected } of testCases) {
    const result = updateFileIcon(content, icon);
    if (result === expected) {
      console.log('✅', name);
      passed++;
    } else {
      console.error('❌', name);
      console.log('Expected:', expected);
      console.log('Got:', result);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  return failed === 0;
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('🧪 Running all filesystem tests...\n');

  try {
    // Test 1: Icon functions (no workspace needed)
    testReadFileIcon();
    console.log('\n');
    testUpdateFileIcon();
    console.log('\n');

    // Test 2: Try to restore workspace
    let handle = await testRestoreWorkspace();
    console.log('\n');

    // Test 3: If no workspace, open one
    if (!handle) {
      console.log('No workspace found. Opening directory picker...');
      handle = await testOpenWorkspace();
      console.log('\n');
    }

    // Test 4: Build file tree
    await testBuildFileTree(handle);
    console.log('\n');

    // Test 5: Read/write file
    await testReadWriteFile(handle);
    console.log('\n');

    // Test 6: Create/delete directory
    await testCreateDeleteDirectory(handle);
    console.log('\n');

    console.log('✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Export for browser console usage
(window as any).fsTests = {
  runAllTests,
  testOpenWorkspace,
  testRestoreWorkspace,
  testBuildFileTree,
  testReadWriteFile,
  testCreateDeleteDirectory,
  testReadFileIcon,
  testUpdateFileIcon,
};

console.log('💡 Filesystem tests available at: window.fsTests');
console.log('   Run window.fsTests.runAllTests() to execute all tests');
