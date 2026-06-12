#!/bin/bash
# Setup script to copy the LiteRT model to the correct location for development testing.
# The model file will be placed in the app's Application Support directory.
#
# Usage: ./setup_litert_model.sh
#
# For development/simulator testing, we copy to a known path.
# In production, the model would be downloaded at runtime.

MODEL_SOURCE="$HOME/Downloads/gemma-4-E2B-it.litertlm"
# For simulator: ~/Library/Developer/CoreSimulator/Devices/.../data/Containers/Data/Application/.../Library/Application Support/LiteRT/Models/
# For development on device/Mac Catalyst, we'll use a path the app can find at runtime.

# Create the target directory structure
TARGET_DIR="$HOME/Library/Application Support/LiteRT/Models"
mkdir -p "$TARGET_DIR"

if [ -f "$MODEL_SOURCE" ]; then
    echo "Copying model file to: $TARGET_DIR/"
    cp "$MODEL_SOURCE" "$TARGET_DIR/gemma-4-E2B-it.litertlm"
    echo "Done! Model size: $(du -h "$TARGET_DIR/gemma-4-E2B-it.litertlm" | cut -f1)"
else
    echo "Error: Model file not found at $MODEL_SOURCE"
    echo "Please download gemma-4-E2B-it.litertlm to ~/Downloads/"
    exit 1
fi
