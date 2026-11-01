#!/usr/bin/env python3
"""
tally_to_lead_converter.py
LAKHI ELECTRONICS AIRCONDITIONERS - DATA NORMALIZATION & MIGRATION CONVERTER

Ingests Tally XML/JSON data and converts strictly into LEA-D 4.0 schema
with root-level aliases (inventory, stock, bills), flat invoice properties,
and flat stock properties.
"""

import os
import sys
from scripts.lead_converter_runner import main

if __name__ == "__main__":
    main()
