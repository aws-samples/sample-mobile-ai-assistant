/**
 * ApplyDiff - A robust diff application utility
 *
 * Diff Format:
 * @@@@
 * [context lines - no prefix]
 * -[lines to remove]
 * +[lines to add]
 * [context lines - no prefix]
 *
 * Features:
 * - Three-layer fallback matching (exact -> trimmed -> anchor)
 * - Handles out-of-order blocks by sorting
 * - Supports multiple change segments within a single @@@@ block
 */

/** A single change segment within a diff block */
interface ChangeSegment {
  contextBefore: string[];
  removals: string[];
  additions: string[];
}

/** A complete diff block (one @@@@ section) with potentially multiple segments */
interface DiffBlock {
  segments: ChangeSegment[];
  contextBefore: string[]; // First segment's context (for positioning)
  removals: string[]; // First segment's removals (for positioning)
  firstMiddleContext: string[]; // First middle context block (after first change, for unique matching)
  trailingContext: string[]; // Context after the last change (for reverse positioning)
}

/** Positioned block with its location in source file */
interface PositionedBlock {
  block: DiffBlock;
  position: number;
  originalIndex: number;
}

export interface ApplyDiffResult {
  success: boolean;
  result: string;
  error?: string;
}

/** Check if a line is a block separator (starts with @@ and ends with @@) */
function isBlockSeparator(line: string): boolean {
  const trimmed = line.trim();
  const len = trimmed.length;
  return (
    len >= 4 &&
    trimmed[0] === '@' &&
    trimmed[1] === '@' &&
    trimmed[len - 1] === '@' &&
    trimmed[len - 2] === '@'
  );
}

/**
 * Parse diff content into blocks with multiple segments
 */
function parseDiffBlocks(diffContent: string): DiffBlock[] {
  const lines = diffContent.split('\n');
  const blocks: DiffBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    if (isBlockSeparator(lines[i])) {
      i++;

      const segments: ChangeSegment[] = [];
      let currentContext: string[] = [];
      let currentRemovals: string[] = [];
      let currentAdditions: string[] = [];
      let inChange = false;

      while (i < lines.length && !isBlockSeparator(lines[i])) {
        const line = lines[i];

        if (line.startsWith('-')) {
          inChange = true;
          currentRemovals.push(line.substring(1));
        } else if (line.startsWith('+')) {
          inChange = true;
          currentAdditions.push(line.substring(1));
        } else {
          const content = line.startsWith(' ') ? line.substring(1) : line;

          if (inChange) {
            // Save current segment when hitting context after changes
            if (currentRemovals.length > 0 || currentAdditions.length > 0) {
              segments.push({
                contextBefore: currentContext,
                removals: currentRemovals,
                additions: currentAdditions,
              });
            }
            currentContext = [content];
            currentRemovals = [];
            currentAdditions = [];
            inChange = false;
          } else {
            currentContext.push(content);
          }
        }
        i++;
      }

      // Save last segment
      let trailingContext: string[] = [];
      if (currentRemovals.length > 0 || currentAdditions.length > 0) {
        segments.push({
          contextBefore: currentContext,
          removals: currentRemovals,
          additions: currentAdditions,
        });
      } else if (inChange === false && currentContext.length > 0) {
        // No more changes, remaining context is trailing context
        trailingContext = currentContext;
      }

      if (segments.length > 0) {
        // Extract first middle context (context of second segment, if exists)
        const firstMiddleContext =
          segments.length > 1 ? segments[1].contextBefore : [];

        blocks.push({
          segments,
          contextBefore: segments[0].contextBefore,
          removals: segments[0].removals,
          firstMiddleContext,
          trailingContext,
        });
      }
    } else {
      i++;
    }
  }

  return blocks;
}

/** Layer 1: Exact match */
function exactMatch(
  sourceLines: string[],
  pattern: string[],
  startFrom: number = 0
): number {
  if (pattern.length === 0) {
    return -1;
  }

  for (let i = startFrom; i <= sourceLines.length - pattern.length; i++) {
    let matches = true;
    for (let j = 0; j < pattern.length; j++) {
      if (sourceLines[i + j] !== pattern[j]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return i;
    }
  }
  return -1;
}

/** Layer 2: Trimmed match (whitespace tolerant) */
function trimmedMatch(
  sourceLines: string[],
  pattern: string[],
  startFrom: number = 0
): number {
  if (pattern.length === 0) {
    return -1;
  }

  for (let i = startFrom; i <= sourceLines.length - pattern.length; i++) {
    let matches = true;
    for (let j = 0; j < pattern.length; j++) {
      if (sourceLines[i + j].trim() !== pattern[j].trim()) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return i;
    }
  }
  return -1;
}

/** Layer 3: Anchor match (first + last line only) */
function anchorMatch(
  sourceLines: string[],
  pattern: string[],
  startFrom: number = 0
): number {
  if (pattern.length < 3) {
    return -1;
  }

  const firstLine = pattern[0];
  const lastLine = pattern[pattern.length - 1];

  for (let i = startFrom; i <= sourceLines.length - pattern.length; i++) {
    if (
      sourceLines[i].trim() === firstLine.trim() &&
      sourceLines[i + pattern.length - 1].trim() === lastLine.trim()
    ) {
      return i;
    }
  }
  return -1;
}

/** Remove trailing empty lines (AI often adds extra) */
function trimTrailingEmptyLines(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === '') {
    end--;
  }
  return lines.slice(0, end);
}

/** Try matching with overlapping context fix (AI mistakenly included removal lines in context) */
function tryMatchWithOverlapFix(
  sourceLines: string[],
  context: string[],
  removals: string[],
  startFrom: number
): number {
  if (context.length === 0 || removals.length === 0) {
    return -1;
  }

  const maxOverlap = Math.min(context.length, removals.length);
  for (let overlap = maxOverlap; overlap >= 1; overlap--) {
    const contextTail = context.slice(-overlap);
    const removalHead = removals.slice(0, overlap);
    // Check if context tail matches removal head
    if (
      contextTail.every((line, idx) => line.trim() === removalHead[idx].trim())
    ) {
      const fixedContext = context.slice(0, -overlap);
      const fixedPattern = [...fixedContext, ...removals];
      let pos = trimmedMatch(sourceLines, fixedPattern, startFrom);
      if (pos !== -1) {
        return pos + fixedContext.length;
      }
      // Also try with removals only if context becomes empty
      if (fixedContext.length === 0) {
        pos = trimmedMatch(sourceLines, removals, startFrom);
        if (pos !== -1) {
          return pos;
        }
        // Try from beginning if not found after startFrom (blocks may be out of order)
        if (startFrom > 0) {
          pos = trimmedMatch(sourceLines, removals, 0);
          if (pos !== -1) {
            return pos;
          }
        }
      }
    }
  }
  return -1;
}

/** Find all positions where pattern matches */
function findAllMatches(
  sourceLines: string[],
  pattern: string[],
  startFrom: number = 0
): number[] {
  if (pattern.length === 0) {
    return [];
  }

  const positions: number[] = [];
  for (let i = startFrom; i <= sourceLines.length - pattern.length; i++) {
    let matches = true;
    for (let j = 0; j < pattern.length; j++) {
      if (sourceLines[i + j].trim() !== pattern[j].trim()) {
        matches = false;
        break;
      }
    }
    if (matches) {
      positions.push(i);
    }
  }
  return positions;
}

/**
 * Find block position using three-layer fallback strategy
 */
function findBlockPosition(
  sourceLines: string[],
  block: DiffBlock,
  startFrom: number = 0
): number {
  const { contextBefore, removals } = block;

  // For pure additions, trim trailing empty lines from context
  const effectiveContext =
    removals.length === 0
      ? trimTrailingEmptyLines(contextBefore)
      : contextBefore;

  const fullPattern = [...effectiveContext, ...removals];
  if (fullPattern.length === 0) {
    return -1;
  }

  // Layer 1: Exact match
  let pos = exactMatch(sourceLines, fullPattern, startFrom);
  if (pos !== -1) {
    return pos + effectiveContext.length;
  }

  // Layer 2: Trimmed match
  pos = trimmedMatch(sourceLines, fullPattern, startFrom);
  if (pos !== -1) {
    return pos + effectiveContext.length;
  }

  // Layer 3: Anchor match
  if (fullPattern.length >= 3) {
    pos = anchorMatch(sourceLines, fullPattern, startFrom);
    if (pos !== -1) {
      return pos + effectiveContext.length;
    }
  }

  // For pure additions, try progressively smaller context
  if (removals.length === 0 && effectiveContext.length > 0) {
    for (const size of [10, 8, 6, 5, 4, 3]) {
      if (effectiveContext.length >= size) {
        const lastN = effectiveContext.slice(-size);
        pos = trimmedMatch(sourceLines, lastN, startFrom);
        if (pos !== -1) {
          return pos + size;
        }
      }
    }
  }

  // For pure additions with short context, try removing leading context lines
  // (AI sometimes generates wrong leading context but correct trailing context)
  // Only accept if we find a UNIQUE match to avoid ambiguity
  if (removals.length === 0 && effectiveContext.length >= 2) {
    for (let skip = 1; skip < effectiveContext.length; skip++) {
      const partialContext = effectiveContext.slice(skip);
      // Require at least 1 line with meaningful content
      if (partialContext.some(line => line.trim().length >= 5)) {
        const matches = findAllMatches(sourceLines, partialContext, startFrom);
        if (matches.length === 1) {
          // Unique match found
          return matches[0] + partialContext.length;
        }
      }
    }
  }

  // Fallback: reduced context + removals
  if (effectiveContext.length > 0 && removals.length > 0) {
    for (const contextSize of [2, 1]) {
      if (contextSize > effectiveContext.length) {
        continue;
      }
      const reducedContext = effectiveContext.slice(-contextSize);
      const reducedPattern = [...reducedContext, ...removals];
      pos = trimmedMatch(sourceLines, reducedPattern, startFrom);
      if (pos !== -1) {
        return pos + reducedContext.length;
      }
    }
  }

  // Last resort: removals only
  if (
    removals.length >= 2 ||
    (removals.length === 1 && removals[0].trim().length >= 5)
  ) {
    pos = trimmedMatch(sourceLines, removals, startFrom);
    if (pos !== -1) {
      return pos;
    }
  }

  // Extra fallback: context + first removal
  if (effectiveContext.length > 0 && removals.length > 0) {
    const contextPlusFirst = [...effectiveContext, removals[0]];
    pos = trimmedMatch(sourceLines, contextPlusFirst, startFrom);
    if (pos !== -1) {
      return pos + effectiveContext.length;
    }

    if (effectiveContext.length >= 2) {
      const reducedPattern = [...effectiveContext.slice(-2), removals[0]];
      pos = trimmedMatch(sourceLines, reducedPattern, startFrom);
      if (pos !== -1) {
        return pos + 2;
      }
    }

    const minPattern = [
      effectiveContext[effectiveContext.length - 1],
      removals[0],
    ];
    pos = trimmedMatch(sourceLines, minPattern, startFrom);
    if (pos !== -1) {
      return pos + 1;
    }
  }

  // Fallback: fix overlapping context (AI mistakenly included removal lines in context)
  pos = tryMatchWithOverlapFix(
    sourceLines,
    effectiveContext,
    removals,
    startFrom
  );
  if (pos !== -1) {
    return pos;
  }

  // Fallback: use trailingContext for reverse positioning
  // (AI sometimes generates completely wrong leading context but correct trailing context)
  const { trailingContext } = block;
  if (trailingContext.length > 0) {
    // Trim leading empty lines from trailingContext
    let trimmedTrailing = trailingContext;
    while (trimmedTrailing.length > 0 && trimmedTrailing[0].trim() === '') {
      trimmedTrailing = trimmedTrailing.slice(1);
    }

    if (trimmedTrailing.length > 0) {
      // Strategy 1: Try full trailingContext match (unique only)
      let trailingMatches = findAllMatches(
        sourceLines,
        trimmedTrailing,
        startFrom
      );
      if (trailingMatches.length === 1) {
        return trailingMatches[0];
      }

      // Strategy 2: Try progressively smaller trailing context (from end)
      // Use last N lines which are usually more unique
      for (const size of [3, 2, 1]) {
        if (trimmedTrailing.length > size) {
          const lastN = trimmedTrailing.slice(-size);
          // Require meaningful content
          if (lastN.some(line => line.trim().length >= 5)) {
            trailingMatches = findAllMatches(sourceLines, lastN, startFrom);
            if (trailingMatches.length === 1) {
              // Adjust position: we matched lastN, need to find where full trailing starts
              return trailingMatches[0] - (trimmedTrailing.length - size);
            }
          }
        }
      }

      // Strategy 3: Try removing leading lines from trailingContext
      // (AI might include wrong leading lines but correct trailing lines)
      for (let skip = 1; skip < trimmedTrailing.length; skip++) {
        const partialTrailing = trimmedTrailing.slice(skip);
        if (partialTrailing.some(line => line.trim().length >= 5)) {
          trailingMatches = findAllMatches(
            sourceLines,
            partialTrailing,
            startFrom
          );
          if (trailingMatches.length === 1) {
            // Adjust position: we matched partial, insertion is before it
            return trailingMatches[0];
          }
        }
      }
    }
  }

  return -1;
}

function getIndent(line: string): string {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : '';
}

/** Apply indentation from reference line, preserving relative indent */
function applyIndent(
  newLine: string,
  referenceLine: string,
  baseIndent: string = ''
): string {
  const trimmed = newLine.trim();
  if (trimmed === '') {
    return '';
  }

  const refIndent = getIndent(referenceLine);
  const newLineIndent = getIndent(newLine);

  if (baseIndent) {
    const relativeIndent = Math.max(
      0,
      newLineIndent.length - baseIndent.length
    );
    return refIndent + ' '.repeat(relativeIndent) + trimmed;
  }
  return refIndent + trimmed;
}

/** Find segment position using context and removals */
function findSegmentPosition(
  sourceLines: string[],
  segment: ChangeSegment,
  startFrom: number
): number {
  const { contextBefore, removals } = segment;

  const effectiveContext =
    removals.length === 0
      ? trimTrailingEmptyLines(contextBefore)
      : contextBefore;

  const fullPattern = [...effectiveContext, ...removals];
  // For pure additions with empty/whitespace-only context within a block,
  // insert at current position (right after previous segment)
  if (fullPattern.length === 0) {
    return removals.length === 0 ? startFrom : -1;
  }

  let pos = exactMatch(sourceLines, fullPattern, startFrom);
  if (pos !== -1) {
    return pos + effectiveContext.length;
  }

  pos = trimmedMatch(sourceLines, fullPattern, startFrom);
  if (pos !== -1) {
    return pos + effectiveContext.length;
  }

  if (fullPattern.length >= 3) {
    pos = anchorMatch(sourceLines, fullPattern, startFrom);
    if (pos !== -1) {
      return pos + effectiveContext.length;
    }
  }

  // For pure additions, try smaller context chunks
  if (removals.length === 0 && effectiveContext.length > 0) {
    for (const size of [10, 8, 6, 5, 4, 3, 2]) {
      if (effectiveContext.length >= size) {
        const lastN = effectiveContext.slice(-size);
        pos = trimmedMatch(sourceLines, lastN, startFrom);
        if (pos !== -1) {
          return pos + size;
        }
      }
    }
  }

  // Fallback: fix overlapping context
  pos = tryMatchWithOverlapFix(
    sourceLines,
    effectiveContext,
    removals,
    startFrom
  );
  if (pos !== -1) {
    return pos;
  }

  return -1;
}

/**
 * Apply diff to original content
 */
export function applyDiff(
  originalContent: string,
  diffContent: string
): ApplyDiffResult {
  try {
    const blocks = parseDiffBlocks(diffContent);

    if (blocks.length === 0) {
      return {
        success: false,
        result: originalContent,
        error:
          'No valid diff blocks found (blocks should be separated by @@@@)',
      };
    }

    const sourceLines = originalContent.split('\n');
    const positionedBlocks: PositionedBlock[] = [];

    // Find position for each block with improved matching strategy
    let lastBlockEnd = 0; // Track end of last block for fallback

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const { contextBefore, removals, firstMiddleContext } = block;

      // Build the pattern for matching
      const effectiveContext =
        removals.length === 0
          ? trimTrailingEmptyLines(contextBefore)
          : contextBefore;
      const fullPattern = [...effectiveContext, ...removals];

      let position = -1;

      if (fullPattern.length > 0) {
        // Find all matching positions
        const allPositions = findAllMatches(sourceLines, fullPattern, 0);

        if (allPositions.length === 1) {
          // Unique match - use it directly
          position = allPositions[0] + effectiveContext.length;
        } else if (allPositions.length > 1) {
          // Multiple matches - try to disambiguate using middle context
          if (firstMiddleContext.length > 0) {
            // Sort candidates to prefer those after lastBlockEnd
            const sortedCandidates = [...allPositions].sort((a, b) => {
              const aAfter =
                a + effectiveContext.length >= lastBlockEnd ? 0 : 1;
              const bAfter =
                b + effectiveContext.length >= lastBlockEnd ? 0 : 1;
              return aAfter - bAfter || a - b;
            });

            for (const candidatePos of sortedCandidates) {
              const changePos = candidatePos + effectiveContext.length;
              const searchAfter = changePos + removals.length;

              // Check if middle context matches after this candidate
              const middlePositions = findAllMatches(
                sourceLines,
                firstMiddleContext,
                searchAfter
              );
              if (
                middlePositions.length > 0 &&
                middlePositions[0] < searchAfter + 100
              ) {
                position = changePos;
                break;
              }
            }
          }

          // Still not unique? Use fallback: find first match after last block
          if (position === -1) {
            for (const candidatePos of allPositions) {
              const changePos = candidatePos + effectiveContext.length;
              if (changePos >= lastBlockEnd) {
                position = changePos;
                break;
              }
            }
          }

          // Last resort: use the first match
          if (position === -1 && allPositions.length > 0) {
            position = allPositions[0] + effectiveContext.length;
          }
        }
      }

      // If still not found, try original fallback strategies
      if (position === -1) {
        position = findBlockPosition(sourceLines, block, lastBlockEnd);
      }

      // Fallback: use firstMiddleContext to reverse-locate position
      // When context is wrong but middle context exists, find middle context position
      // and calculate insertion point by going back removals.length lines
      // Only accept unique match to avoid ambiguity (consistent with trailingContext strategy)
      if (position === -1 && firstMiddleContext.length > 0) {
        const middlePositions = findAllMatches(
          sourceLines,
          firstMiddleContext,
          lastBlockEnd
        );
        if (middlePositions.length === 1) {
          position = middlePositions[0] - removals.length;
        }
      }

      if (position === -1) {
        const context = block.contextBefore.slice(0, 2).join('\n');
        const removal = block.removals.slice(0, 2).join('\n');
        return {
          success: false,
          result: originalContent,
          error: `Block ${
            i + 1
          }: Cannot find matching position.\nContext: ${context}\nRemovals: ${removal}`,
        };
      }

      // Calculate total removals for this block
      const totalRemovals = block.segments.reduce(
        (sum, seg) => sum + seg.removals.length,
        0
      );
      lastBlockEnd = position + totalRemovals;

      positionedBlocks.push({ block, position, originalIndex: i });
    }

    // Sort by position (should already be in order with new strategy, but ensure)
    positionedBlocks.sort((a, b) => a.position - b.position);

    // Check for overlapping blocks
    for (let i = 1; i < positionedBlocks.length; i++) {
      const prev = positionedBlocks[i - 1];
      const curr = positionedBlocks[i];
      const prevTotalRemovals = prev.block.segments.reduce(
        (sum, seg) => sum + seg.removals.length,
        0
      );
      const prevEnd = prev.position + prevTotalRemovals;

      if (curr.position < prevEnd) {
        return {
          success: false,
          result: originalContent,
          error: `Overlapping blocks: Block ${
            prev.originalIndex + 1
          } overlaps with Block ${curr.originalIndex + 1}`,
        };
      }
    }

    // Apply changes
    const resultLines: string[] = [];
    let sourceIdx = 0;

    for (const { block, position } of positionedBlocks) {
      while (sourceIdx < position) {
        resultLines.push(sourceLines[sourceIdx]);
        sourceIdx++;
      }

      let segmentSearchStart = sourceIdx;

      for (let segIdx = 0; segIdx < block.segments.length; segIdx++) {
        const segment = block.segments[segIdx];

        let segmentPos: number;
        if (segIdx === 0) {
          segmentPos = position;
        } else {
          segmentPos = findSegmentPosition(
            sourceLines,
            segment,
            segmentSearchStart
          );
          if (segmentPos === -1) {
            segmentPos = findSegmentPosition(sourceLines, segment, sourceIdx);
          }
        }

        if (segmentPos === -1) {
          return {
            success: false,
            result: originalContent,
            error: `Block segment: Cannot find position for segment ${
              segIdx + 1
            }`,
          };
        }

        while (sourceIdx < segmentPos) {
          resultLines.push(sourceLines[sourceIdx]);
          sourceIdx++;
        }

        // Pure additions: trust diff's indentation; Replacements: adjust to match
        const isPureAddition = segment.removals.length === 0;

        if (isPureAddition) {
          for (const addition of segment.additions) {
            resultLines.push(addition);
          }
        } else {
          const refLine =
            sourceIdx < sourceLines.length ? sourceLines[sourceIdx] : '';
          let baseIndent = '';
          for (const add of segment.additions) {
            if (add.trim() !== '') {
              baseIndent = getIndent(add);
              break;
            }
          }

          for (const addition of segment.additions) {
            if (addition.trim() === '') {
              resultLines.push('');
            } else {
              resultLines.push(applyIndent(addition, refLine, baseIndent));
            }
          }
        }

        sourceIdx += segment.removals.length;
        segmentSearchStart = sourceIdx;
      }
    }

    while (sourceIdx < sourceLines.length) {
      resultLines.push(sourceLines[sourceIdx]);
      sourceIdx++;
    }

    return { success: true, result: resultLines.join('\n') };
  } catch (error) {
    return {
      success: false,
      result: originalContent,
      error: `Unexpected error: ${String(error)}`,
    };
  }
}

/**
 * Validate diff format without applying
 */
export function validateDiff(diffContent: string): {
  valid: boolean;
  blockCount: number;
  error?: string;
} {
  try {
    const blocks = parseDiffBlocks(diffContent);

    if (blocks.length === 0) {
      return {
        valid: false,
        blockCount: 0,
        error: 'No valid diff blocks found',
      };
    }

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const hasChanges = block.segments.some(
        seg => seg.removals.length > 0 || seg.additions.length > 0
      );
      if (!hasChanges) {
        return {
          valid: false,
          blockCount: blocks.length,
          error: `Block ${i + 1} has no changes`,
        };
      }

      if (block.contextBefore.length === 0 && block.removals.length === 0) {
        return {
          valid: false,
          blockCount: blocks.length,
          error: `Block ${i + 1} has no context or removals for positioning`,
        };
      }
    }

    return { valid: true, blockCount: blocks.length };
  } catch (error) {
    return { valid: false, blockCount: 0, error: String(error) };
  }
}
