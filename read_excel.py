import pandas as pd
import numpy as np

# Read the Excel file
df = pd.read_excel('rm_store_structure.xlsx')

# Display basic information about the dataframe
print("Shape of the dataframe:", df.shape)
print("\nColumn names:")
print(df.columns.tolist())

# Display the first 10 rows to understand the structure
print("\nFirst 10 rows of the data:")
print(df.head(10).to_string())

# Check for specific columns related to area managers and store managers
am_columns = ['am_username', 'am_email']
sm_columns = ['Store_manager_username', 'Store_manager_email']

print("\n" + "="*50)
print("Area Manager Columns Analysis:")
for col in am_columns:
    if col in df.columns:
        print(f"\n{col}:")
        print(f"  - Total entries: {len(df)}")
        print(f"  - Non-null entries: {df[col].notna().sum()}")
        print(f"  - Null/empty entries: {df[col].isna().sum()}")
        print(f"  - Unique values: {df[col].nunique()}")
        print(f"  - Sample values: {df[col].dropna().head(5).tolist()}")

print("\n" + "="*50)
print("Store Manager Columns Analysis:")
for col in sm_columns:
    if col in df.columns:
        print(f"\n{col}:")
        print(f"  - Total entries: {len(df)}")
        print(f"  - Non-null entries: {df[col].notna().sum()}")
        print(f"  - Null/empty entries: {df[col].isna().sum()}")
        print(f"  - Unique values: {df[col].nunique()}")
        print(f"  - Sample values: {df[col].dropna().head(5).tolist()}")

# Check data types
print("\n" + "="*50)
print("Data types of all columns:")
print(df.dtypes)