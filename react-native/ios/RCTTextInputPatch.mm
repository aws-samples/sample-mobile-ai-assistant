#import "RCTTextInputPatch.h"
#import <objc/runtime.h>
#import <objc/message.h>
#import <UIKit/UIKit.h>
#import <React/RCTBackedTextInputViewProtocol.h>
#import <React/RCTTextAttributes.h>
#import <React/UIView+React.h>
#import "Modules/FilePaste/FilePasteModule.h"

// Forward declarations for React Native classes
@class RCTTextInputComponentView;
@class RCTUITextField;
@class RCTUITextView;

@implementation RCTTextInputPatch

static BOOL altKeyPressed = NO;
static BOOL commandPressed = NO;
static BOOL shiftPressed = NO;
static IMP originalTextInputShouldChangeTextIMP = NULL;
static IMP originalTextFieldPressesBegan = NULL;
static IMP originalTextFieldPressesEnded = NULL;
static IMP originalTextViewPressesBegan = NULL;
static IMP originalTextViewPressesEnded = NULL;
static IMP originalTextInputShouldSubmitOnReturn = NULL;

+ (void)setupTextInputPatch {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        // For RN 0.83+ with new architecture, we need to patch:
        // 1. RCTTextInputComponentView - for textInputShouldSubmitOnReturn and textInputShouldChangeText:inRange:
        // 2. RCTUITextField and RCTUITextView - for pressesBegan/pressesEnded (they inherit from UITextField/UITextView)

        // Try new architecture first (RCTTextInputComponentView)
        Class componentViewClass = NSClassFromString(@"RCTTextInputComponentView");
        if (componentViewClass) {
            [self setupComponentViewPatches:componentViewClass];
            NSLog(@"🚀 RCTTextInputPatch: Patched RCTTextInputComponentView (new architecture)");
        }

        // Also try legacy architecture (RCTBaseTextInputView) for backwards compatibility
        Class baseTextInputClass = NSClassFromString(@"RCTBaseTextInputView");
        if (baseTextInputClass) {
            [self setupBaseTextInputPatches:baseTextInputClass];
            NSLog(@"🚀 RCTTextInputPatch: Patched RCTBaseTextInputView (legacy architecture)");
        }

        // Patch the underlying text input views for pressesBegan/pressesEnded
        // These classes handle the actual keyboard events
        Class textFieldClass = NSClassFromString(@"RCTUITextField");
        if (textFieldClass) {
            [self setupPressEventPatches:textFieldClass isTextField:YES];
            NSLog(@"🚀 RCTTextInputPatch: Patched RCTUITextField for press events");
        }

        Class textViewClass = NSClassFromString(@"RCTUITextView");
        if (textViewClass) {
            [self setupPressEventPatches:textViewClass isTextField:NO];
            NSLog(@"🚀 RCTTextInputPatch: Patched RCTUITextView for press events");
        }

        NSLog(@"🚀 RCTTextInputPatch: Method swizzling completed");
    });
}

+ (void)setupComponentViewPatches:(Class)targetClass {
    // Swizzle textInputShouldSubmitOnReturn
    Method originalSubmitMethod = class_getInstanceMethod(targetClass, @selector(textInputShouldSubmitOnReturn));
    if (originalSubmitMethod) {
        originalTextInputShouldSubmitOnReturn = method_getImplementation(originalSubmitMethod);
        Method swizzledSubmitMethod = class_getInstanceMethod([RCTTextInputPatch class], @selector(swizzled_textInputShouldSubmitOnReturn));
        method_setImplementation(originalSubmitMethod, method_getImplementation(swizzledSubmitMethod));
    }

    // Swizzle textInputShouldChangeText:inRange:
    Method originalChangeTextMethod = class_getInstanceMethod(targetClass, @selector(textInputShouldChangeText:inRange:));
    if (originalChangeTextMethod) {
        originalTextInputShouldChangeTextIMP = method_getImplementation(originalChangeTextMethod);
        Method swizzledChangeTextMethod = class_getInstanceMethod([RCTTextInputPatch class], @selector(swizzled_textInputShouldChangeText:inRange:));
        method_setImplementation(originalChangeTextMethod, method_getImplementation(swizzledChangeTextMethod));
    }
}

+ (void)setupBaseTextInputPatches:(Class)targetClass {
    // Same patches for legacy architecture
    Method originalSubmitMethod = class_getInstanceMethod(targetClass, @selector(textInputShouldSubmitOnReturn));
    if (originalSubmitMethod && !originalTextInputShouldSubmitOnReturn) {
        originalTextInputShouldSubmitOnReturn = method_getImplementation(originalSubmitMethod);
        Method swizzledSubmitMethod = class_getInstanceMethod([RCTTextInputPatch class], @selector(swizzled_textInputShouldSubmitOnReturn));
        method_setImplementation(originalSubmitMethod, method_getImplementation(swizzledSubmitMethod));
    }

    Method originalChangeTextMethod = class_getInstanceMethod(targetClass, @selector(textInputShouldChangeText:inRange:));
    if (originalChangeTextMethod && !originalTextInputShouldChangeTextIMP) {
        originalTextInputShouldChangeTextIMP = method_getImplementation(originalChangeTextMethod);
        Method swizzledChangeTextMethod = class_getInstanceMethod([RCTTextInputPatch class], @selector(swizzled_textInputShouldChangeText:inRange:));
        method_setImplementation(originalChangeTextMethod, method_getImplementation(swizzledChangeTextMethod));
    }
}

+ (void)setupPressEventPatches:(Class)targetClass isTextField:(BOOL)isTextField {
    IMP *pressesBeganIMP = isTextField ? &originalTextFieldPressesBegan : &originalTextViewPressesBegan;
    IMP *pressesEndedIMP = isTextField ? &originalTextFieldPressesEnded : &originalTextViewPressesEnded;

    Method swizzledPressesBegan = class_getInstanceMethod([RCTTextInputPatch class], @selector(swizzled_pressesBegan:withEvent:));
    Method swizzledPressesEnded = class_getInstanceMethod([RCTTextInputPatch class], @selector(swizzled_pressesEnded:withEvent:));

    // Use class_addMethod to add the method directly on targetClass.
    // This avoids replacing the superclass (UITextField/UITextView) implementation,
    // which would affect ALL instances (e.g. WebView text fields) and cause infinite recursion.
    BOOL addedPressesBegan = class_addMethod(targetClass, @selector(pressesBegan:withEvent:),
                                             method_getImplementation(swizzledPressesBegan),
                                             method_getTypeEncoding(swizzledPressesBegan));
    if (!addedPressesBegan) {
        // targetClass has its own implementation, safe to replace directly
        Method existingPressesBegan = class_getInstanceMethod(targetClass, @selector(pressesBegan:withEvent:));
        *pressesBeganIMP = method_getImplementation(existingPressesBegan);
        method_setImplementation(existingPressesBegan, method_getImplementation(swizzledPressesBegan));
    }
    // If added, the original is the superclass implementation - resolve via objc_msgSendSuper at call time

    BOOL addedPressesEnded = class_addMethod(targetClass, @selector(pressesEnded:withEvent:),
                                             method_getImplementation(swizzledPressesEnded),
                                             method_getTypeEncoding(swizzledPressesEnded));
    if (!addedPressesEnded) {
        Method existingPressesEnded = class_getInstanceMethod(targetClass, @selector(pressesEnded:withEvent:));
        *pressesEndedIMP = method_getImplementation(existingPressesEnded);
        method_setImplementation(existingPressesEnded, method_getImplementation(swizzledPressesEnded));
    }
}

#pragma mark - Press Events (for RCTUITextField and RCTUITextView)

- (void)swizzled_pressesBegan:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
    for (UIPress *press in presses) {
        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardLeftAlt ||
            press.key.keyCode == UIKeyboardHIDUsageKeyboardRightAlt) {
            altKeyPressed = YES;
        }
        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardLeftGUI ||
            press.key.keyCode == UIKeyboardHIDUsageKeyboardRightGUI) {
            commandPressed = YES;
        }
        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardLeftShift ||
            press.key.keyCode == UIKeyboardHIDUsageKeyboardRightShift) {
            shiftPressed = YES;
        }

        // Handle Command+Enter directly here since it doesn't trigger textInputShouldSubmitOnReturn
        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardReturnOrEnter && commandPressed) {
            [RCTTextInputPatch insertNewlineInTextView:(UIView *)self];
            commandPressed = NO;
            return;
        }

        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardV && commandPressed) {
            [RCTTextInputPatch copyPasteboardFilesToClipboardDirectoryWithCompletion:^{
                dispatch_async(dispatch_get_main_queue(), ^{
                    [FilePasteModule sendFilePasteEvent];
                });
            } handleScreenshots:YES];
        }
    }

    // Call original implementation or super
    IMP originalIMP = NULL;
    if ([self isKindOfClass:NSClassFromString(@"RCTUITextField")]) {
        originalIMP = originalTextFieldPressesBegan;
    } else if ([self isKindOfClass:NSClassFromString(@"RCTUITextView")]) {
        originalIMP = originalTextViewPressesBegan;
    }

    if (originalIMP) {
        void (*originalFunc)(id, SEL, NSSet<UIPress *> *, UIPressesEvent *) =
            (void (*)(id, SEL, NSSet<UIPress *> *, UIPressesEvent *))originalIMP;
        originalFunc(self, @selector(pressesBegan:withEvent:), presses, event);
    } else {
        // Call super if no original implementation
        struct objc_super superInfo = {
            .receiver = self,
            .super_class = class_getSuperclass(object_getClass(self))
        };
        void (*superPressesBegan)(struct objc_super *, SEL, NSSet<UIPress *> *, UIPressesEvent *) =
            (void (*)(struct objc_super *, SEL, NSSet<UIPress *> *, UIPressesEvent *))objc_msgSendSuper;
        superPressesBegan(&superInfo, @selector(pressesBegan:withEvent:), presses, event);
    }
}

- (void)swizzled_pressesEnded:(NSSet<UIPress *> *)presses withEvent:(UIPressesEvent *)event
{
    for (UIPress *press in presses) {
        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardLeftAlt ||
            press.key.keyCode == UIKeyboardHIDUsageKeyboardRightAlt) {
            altKeyPressed = NO;
        }
        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardLeftGUI ||
            press.key.keyCode == UIKeyboardHIDUsageKeyboardRightGUI) {
            commandPressed = NO;
        }
        if (press.key.keyCode == UIKeyboardHIDUsageKeyboardLeftShift ||
            press.key.keyCode == UIKeyboardHIDUsageKeyboardRightShift) {
            shiftPressed = NO;
        }
    }

    // Call original implementation or super
    IMP originalIMP = NULL;
    if ([self isKindOfClass:NSClassFromString(@"RCTUITextField")]) {
        originalIMP = originalTextFieldPressesEnded;
    } else if ([self isKindOfClass:NSClassFromString(@"RCTUITextView")]) {
        originalIMP = originalTextViewPressesEnded;
    }

    if (originalIMP) {
        void (*originalFunc)(id, SEL, NSSet<UIPress *> *, UIPressesEvent *) =
            (void (*)(id, SEL, NSSet<UIPress *> *, UIPressesEvent *))originalIMP;
        originalFunc(self, @selector(pressesEnded:withEvent:), presses, event);
    } else {
        // Call super if no original implementation
        struct objc_super superInfo = {
            .receiver = self,
            .super_class = class_getSuperclass(object_getClass(self))
        };
        void (*superPressesEnded)(struct objc_super *, SEL, NSSet<UIPress *> *, UIPressesEvent *) =
            (void (*)(struct objc_super *, SEL, NSSet<UIPress *> *, UIPressesEvent *))objc_msgSendSuper;
        superPressesEnded(&superInfo, @selector(pressesEnded:withEvent:), presses, event);
    }
}

#pragma mark - Text Input Delegate Methods

- (BOOL)swizzled_textInputShouldSubmitOnReturn
{
    if (altKeyPressed || shiftPressed) {
        // Alt+Enter or Shift+Enter - return NO to let RN insert newline via default behavior
        // (submitBehavior="submit" will insert newline when submission is rejected)
        altKeyPressed = NO;
        shiftPressed = NO;
        commandPressed = NO;
        return NO;
    } else {
        // Reset modifier key states
        altKeyPressed = NO;
        shiftPressed = NO;
        commandPressed = NO;

        // Call original implementation
        if (originalTextInputShouldSubmitOnReturn) {
            BOOL (*originalFunc)(id, SEL) = (BOOL (*)(id, SEL))originalTextInputShouldSubmitOnReturn;
            return originalFunc(self, @selector(textInputShouldSubmitOnReturn));
        }

        return YES;
    }
}

- (NSString *)swizzled_textInputShouldChangeText:(NSString *)text inRange:(NSRange)range
{
    // Check if the text being pasted is a file (URL or filename)
    if (text && [RCTTextInputPatch isFilePasteText:text]) {
        // Copy files from pasteboard to clipboard directory, then send event
        [RCTTextInputPatch copyPasteboardFilesToClipboardDirectoryWithCompletion:^{
            dispatch_async(dispatch_get_main_queue(), ^{
                [FilePasteModule sendFilePasteEvent];
            });
        } handleScreenshots:NO];

        // Return nil to prevent the file URL from being inserted as text
        return nil;
    }

    // Call the original method
    if (originalTextInputShouldChangeTextIMP) {
        NSString* (*originalFunc)(id, SEL, NSString*, NSRange) =
            (NSString* (*)(id, SEL, NSString*, NSRange))originalTextInputShouldChangeTextIMP;
        return originalFunc(self, @selector(textInputShouldChangeText:inRange:), text, range);
    }

    return text;
}

#pragma mark - Newline Insertion Helper

+ (void)insertNewlineInTextView:(UIView *)textInputView
{
    // The textInputView is RCTUITextView or RCTUITextField
    id<RCTBackedTextInputViewProtocol> backedTextInputView = nil;

    if ([textInputView conformsToProtocol:@protocol(RCTBackedTextInputViewProtocol)]) {
        backedTextInputView = (id<RCTBackedTextInputViewProtocol>)textInputView;
    }

    if (!backedTextInputView) {
        return;
    }

    UITextRange *selectedRange = backedTextInputView.selectedTextRange;
    if (!selectedRange) {
        return;
    }

    // Use replaceRange:withText: to insert newline
    [backedTextInputView replaceRange:selectedRange withText:@"\n"];

    // Find the parent RCTTextInputComponentView to trigger state update
    UIView *parent = textInputView.superview;
    while (parent) {
        if ([NSStringFromClass([parent class]) isEqualToString:@"RCTTextInputComponentView"]) {
            if ([parent respondsToSelector:@selector(textInputDidChange)]) {
                [parent performSelector:@selector(textInputDidChange)];
            }
            break;
        }
        parent = parent.superview;
    }
}

#pragma mark - File Handling Utilities

+ (void)copyPasteboardFilesToClipboardDirectoryWithCompletion:(void(^)(void))completion handleScreenshots:(BOOL)handleScreenshots
{
    // Capture pasteboard items immediately on main thread
    UIPasteboard *pasteboard = [UIPasteboard generalPasteboard];
    NSArray *pasteboardItems = [pasteboard.items copy];

    // Perform file operations on background queue
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
        // Get app documents directory
        NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
        NSString *documentsPath = [paths objectAtIndex:0];
        NSString *clipboardPath = [documentsPath stringByAppendingPathComponent:@"clipboard"];

        // Remove entire clipboard directory if it exists
        NSFileManager *fileManager = [NSFileManager defaultManager];
        NSError *error = nil;

        if ([fileManager fileExistsAtPath:clipboardPath]) {
            [fileManager removeItemAtPath:clipboardPath error:&error];
        }

        // Create fresh clipboard directory
        [fileManager createDirectoryAtPath:clipboardPath
               withIntermediateDirectories:YES
                                attributes:nil
                                     error:&error];

        // Copy files from pasteboard
        for (NSInteger index = 0; index < pasteboardItems.count; index++) {
            NSDictionary *item = pasteboardItems[index];
            BOOL itemProcessed = NO;

            // First try to handle image data (for screenshots) - only if handleScreenshots is YES
            if (handleScreenshots) {
                NSData *imageData = nil;
                NSString *imageExtension = @"png";

                // Mac screenshots are always PNG format
                id imageObject = [item objectForKey:@"public.png"];
                if (imageObject) {
                    imageExtension = @"png";
                    // Convert UIImage to NSData if needed
                    if ([imageObject isKindOfClass:[UIImage class]]) {
                        UIImage *image = (UIImage *)imageObject;
                        imageData = UIImagePNGRepresentation(image);
                    } else if ([imageObject isKindOfClass:[NSData class]]) {
                        imageData = (NSData *)imageObject;
                    }
                }

                if (imageData && [imageData isKindOfClass:[NSData class]] && imageData.length > 0) {
                    // Generate filename for screenshot
                    NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
                    [formatter setDateFormat:@"yyyy-MM-dd_HH-mm-ss"];
                    NSString *timestamp = [formatter stringFromDate:[NSDate date]];
                    NSString *baseFileName = [NSString stringWithFormat:@"Screenshot_%@", timestamp];

                    // Generate unique filename
                    NSString *destinationFileName = [NSString stringWithFormat:@"%@.%@", baseFileName, imageExtension];
                    NSInteger counter = 1;

                    while ([fileManager fileExistsAtPath:[clipboardPath stringByAppendingPathComponent:destinationFileName]]) {
                        destinationFileName = [NSString stringWithFormat:@"%@_%ld.%@", baseFileName, (long)counter, imageExtension];
                        counter++;
                    }

                    NSString *destinationPath = [clipboardPath stringByAppendingPathComponent:destinationFileName];

                    // Write image data to file
                    NSError *writeError = nil;
                    BOOL success = [imageData writeToFile:destinationPath options:NSDataWritingAtomic error:&writeError];

                    if (success) {
                        itemProcessed = YES;
                    } else {
                        NSLog(@"❌ Failed to save screenshot: %@", writeError.localizedDescription);
                    }
                }
            }

            // If no image data found, try to handle as file URL
            if (!itemProcessed) {
                NSURL *fileURL = nil;

                // Try public.file-url first
                id fileUrlData = [item objectForKey:@"public.file-url"];
                if (fileUrlData) {
                    if ([fileUrlData isKindOfClass:[NSData class]]) {
                        NSString *urlString = [[NSString alloc] initWithData:fileUrlData encoding:NSUTF8StringEncoding];
                        if (urlString) {
                            fileURL = [NSURL URLWithString:urlString];
                        }
                    } else if ([fileUrlData isKindOfClass:[NSString class]]) {
                        fileURL = [NSURL URLWithString:fileUrlData];
                    }
                }

                // Try public.url as fallback
                if (!fileURL) {
                    id urlData = [item objectForKey:@"public.url"];
                    if (urlData) {
                        if ([urlData isKindOfClass:[NSData class]]) {
                            NSString *urlString = [[NSString alloc] initWithData:urlData encoding:NSUTF8StringEncoding];
                            if (urlString) {
                                fileURL = [NSURL URLWithString:urlString];
                            }
                        } else if ([urlData isKindOfClass:[NSString class]]) {
                            fileURL = [NSURL URLWithString:urlData];
                        }
                    }
                }

                // If we have a file URL, copy the file
                if (fileURL && [fileURL isFileURL]) {
                    NSString *sourceFilePath = [fileURL path];
                    NSString *fileName = [sourceFilePath lastPathComponent];

                    // Generate unique filename if file already exists
                    NSString *destinationFileName = fileName;
                    NSInteger counter = 1;
                    NSString *nameWithoutExtension = [fileName stringByDeletingPathExtension];
                    NSString *extension = [fileName pathExtension];

                    while ([fileManager fileExistsAtPath:[clipboardPath stringByAppendingPathComponent:destinationFileName]]) {
                        if (extension.length > 0) {
                            destinationFileName = [NSString stringWithFormat:@"%@_%ld.%@", nameWithoutExtension, (long)counter, extension];
                        } else {
                            destinationFileName = [NSString stringWithFormat:@"%@_%ld", nameWithoutExtension, (long)counter];
                        }
                        counter++;
                    }

                    NSString *destinationPath = [clipboardPath stringByAppendingPathComponent:destinationFileName];

                    // Copy file
                    NSError *copyError = nil;
                    BOOL success = [fileManager copyItemAtPath:sourceFilePath toPath:destinationPath error:&copyError];

                    if (success) {
                        NSLog(@"✅ Successfully copied file: %@", fileName);
                    } else {
                        NSLog(@"❌ Failed to copy file %@: %@", fileName, copyError.localizedDescription);
                    }
                }
            }
        }

        // Call completion callback after all files are processed
        if (completion) {
            completion();
        }
    });
}

+ (BOOL)isFilePasteText:(NSString *)text
{
    // First check if it's a file URL format
    if ([text containsString:@"file:///.file/id="]) {
        return YES;
    }

    // Check if pasteboard contains files and text matches any filename
    UIPasteboard *pasteboard = [UIPasteboard generalPasteboard];
    NSArray *items = pasteboard.items;

    for (NSDictionary *item in items) {
        // Check if this item has file URL data
        BOOL hasFileUrl = [item objectForKey:@"public.file-url"] != nil || [item objectForKey:@"public.url"] != nil;

        if (hasFileUrl) {
            // Try to extract filename from file URLs
            NSArray *urlKeys = @[@"public.file-url", @"public.url"];
            for (NSString *key in urlKeys) {
                id urlData = [item objectForKey:key];
                if (urlData) {
                    NSString *urlString = nil;
                    if ([urlData isKindOfClass:[NSData class]]) {
                        urlString = [[NSString alloc] initWithData:urlData encoding:NSUTF8StringEncoding];
                    } else if ([urlData isKindOfClass:[NSString class]]) {
                        urlString = urlData;
                    }

                    if (urlString) {
                        NSURL *fileURL = [NSURL URLWithString:urlString];
                        if (fileURL && [fileURL isFileURL]) {
                            NSString *fileName = [[fileURL path] lastPathComponent];
                            // Check if the pasted text matches the filename
                            if ([text containsString:fileName]) {
                                return YES;
                            }
                        }
                    }
                }
            }
        }
    }

    return NO;
}

@end
